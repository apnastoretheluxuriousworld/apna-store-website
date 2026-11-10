"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema as s } from "@/lib/db";
import { adminUnreadSql, listMessages, MESSAGE_MAX, type ChatMessage } from "@/lib/data/feedback";
import { markNotificationsReadFor } from "@/lib/data/notifications";
import { signalAdmins, signalConversation } from "@/lib/realtime/server";
import type { ActionResult } from "@/lib/actions";

const idSchema = z.uuid();
const bodySchema = z.string().trim().min(1, "Type a message").max(MESSAGE_MAX, `At most ${MESSAGE_MAX} characters`);
const preview = (t: string) => (t.length > 120 ? t.slice(0, 120).trimEnd() + "…" : t);

/** Reply to a customer. */
export async function sendAdminReply(conversationId: unknown, body: unknown): Promise<ActionResult<{ message: ChatMessage }>> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(conversationId);
  if (!id.success) return { ok: false, error: "Conversation not found." };
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const text = parsed.data;
  // One statement (conversation update + message): every round trip to the DB is felt in a chat.
  const {
    rows: [row],
  } = await db().execute<{ id: string; created_at: string | Date }>(sql`
    with c as (
      update "conversations" set "last_message_at" = now(), "last_message_preview" = ${preview(text)},
        "last_sender" = 'admin', "admin_read_at" = now()
      where "id" = ${id.data}
      returning "id"
    )
    insert into "messages" ("conversation_id", "sender", "admin_id", "body", "created_at")
    select "id", 'admin', ${admin.id}, ${text}, now() from c
    returning "id", "created_at"`);
  const message: ChatMessage | null = row
    ? { id: row.id, sender: "admin", body: text, createdAt: new Date(row.created_at).toISOString() }
    : null;
  if (!message) return { ok: false, error: "Conversation not found." };

  after(() => Promise.all([signalConversation(id.data), signalAdmins(), markNotificationsReadFor(`/admin/feedback/${id.data}`)]));
  revalidatePath("/admin", "layout");
  return { ok: true, data: { message } };
}

/**
 * New messages in a conversation since `since` (all, without it). `seen`:
 * the chat is on screen → the customer's messages (and their notification) are read.
 */
export async function fetchConversation(conversationId: unknown, since: unknown, seen: unknown): Promise<ActionResult<{ messages: ChatMessage[] }>> {
  await requireAdmin();
  const id = idSchema.safeParse(conversationId);
  if (!id.success) return { ok: false, error: "Conversation not found." };
  const parsedSince = z.iso.datetime().safeParse(since);
  const messages = await listMessages(id.data, parsedSince.success ? new Date(parsedSince.data) : undefined);
  if (seen === true) {
    // After the response: marking read doesn't hold up the new messages.
    after(async () => {
      const [cleared] = await Promise.all([
        // Only a chat that had unread messages changes (returns a row).
        db()
          .update(s.conversations)
          .set({ adminReadAt: new Date() })
          .where(and(eq(s.conversations.id, id.data), sql`${adminUnreadSql} > 0`))
          .returning({ id: s.conversations.id }),
        markNotificationsReadFor(`/admin/feedback/${id.data}`),
      ]);
      // Something went from unread to read: admin screens re-check, so the "More" dot and badges clear.
      if (cleared.length) await signalAdmins();
    });
  }
  return { ok: true, data: { messages } };
}
