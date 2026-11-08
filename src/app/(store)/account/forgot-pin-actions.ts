"use server";

import { and, eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/auth/request";
import { db, schema as s } from "@/lib/db";
import { notifyAdminsGrouped } from "@/lib/data/notifications";
import { allowHit } from "@/lib/rate-limit";
import { signalConversation } from "@/lib/realtime/server";
import { formatPhone, phoneSchema } from "@/lib/validation/customer";

export type ForgotPinState = { ok?: boolean; error?: string; phoneError?: string; phone?: string; note?: string };

const NOTE_MAX = 300;
const schema = z.object({
  phone: phoneSchema,
  note: z.string().trim().max(NOTE_MAX, `At most ${NOTE_MAX} characters`).optional().default(""),
});

/**
 * "Forgot PIN": the signed-out customer asks the store to reset it. The request
 * lands in their chat (Admin → Feedback) as a message from them, with an admin
 * notification. The admin checks it's really them and resets the PIN from the
 * customer's page.
 */
export async function requestPinReset(_prev: ForgotPinState, formData: FormData): Promise<ForgotPinState> {
  const raw = { phone: String(formData.get("phone") ?? ""), note: String(formData.get("note") ?? "") };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return issue.path[0] === "phone" ? { ...raw, phoneError: issue.message } : { ...raw, error: issue.message };
  }
  const { phone, note } = parsed.data;

  const ip = (await clientIp()) ?? "unknown";
  if (!(await allowHit(`pinreset:ip:${ip}`, 5, 60 * 60 * 1000)) || !(await allowHit(`pinreset:${phone}`, 3, 24 * 60 * 60 * 1000))) {
    return { ...raw, error: "We've already got your request. The store will contact you soon." };
  }

  try {
    const [user] = await db()
      .select({ id: s.users.id, name: s.users.name })
      .from(s.users)
      .where(and(eq(s.users.phone, phone), eq(s.users.role, "customer")));
    // Same answer whether or not the number has an account, so this form can't
    // be used to find out who shops here.
    if (!user) return { ok: true, phone };

    const text = `🔑 I forgot my PIN. Please reset it and send me the new one.${note ? `\n\n${note}` : ""}`;
    const preview = "🔑 Forgot PIN — please reset it";
    // Same upsert as a chat message, but left unread on the customer's side.
    const {
      rows: [row],
    } = await db().execute<{ conversation_id: string }>(sql`
      with c as (
        insert into "conversations" ("user_id", "last_message_at", "last_message_preview", "last_sender")
        values (${user.id}, now(), ${preview}, 'customer')
        on conflict ("user_id") do update set
          "last_message_at" = now(), "last_message_preview" = excluded."last_message_preview", "last_sender" = 'customer'
        returning "id"
      )
      insert into "messages" ("conversation_id", "sender", "body", "created_at")
      select "id", 'customer', ${text}, now() from c
      returning "conversation_id"`);

    after(() =>
      Promise.all([
        signalConversation(row.conversation_id),
        notifyAdminsGrouped({
          type: "feedback",
          title: `PIN reset request from ${user.name}`,
          body: `+91 ${formatPhone(phone)} forgot their PIN. Confirm it's them, then reset it from their customer page.`,
          href: `/admin/feedback/${row.conversation_id}`,
        }),
      ]),
    );
    return { ok: true, phone };
  } catch (e) {
    console.error("[forgot-pin]", e instanceof Error ? e.message : e);
    return { ...raw, error: "We couldn't reach the store right now. Please try again in a moment." };
  }
}
