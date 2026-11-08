"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { SIGNED_OUT_ERROR } from "@/lib/auth/signed-out";
import { db, schema as s } from "@/lib/db";
import { getMyUnreadReplies, listMyMessages, MESSAGE_MAX, type ChatMessage } from "@/lib/data/feedback";
import { notifyAdminsGrouped } from "@/lib/data/notifications";
import { allowHit } from "@/lib/rate-limit";
import { signalConversation } from "@/lib/realtime/server";
import type { ActionResult } from "@/lib/actions";

const bodySchema = z.string().trim().min(1, "Type a message").max(MESSAGE_MAX, `At most ${MESSAGE_MAX} characters`);
const preview = (t: string) => (t.length > 120 ? t.slice(0, 120).trimEnd() + "…" : t);

async function currentCustomer() {
  const user = await getCurrentUser();
  return user?.role === "customer" ? user : null;
}

/** Send a message to the store. Starts the conversation on the first one. */
export async function sendCustomerMessage(body: unknown): Promise<ActionResult<{ conversationId: string; message: ChatMessage }>> {
  const user = await currentCustomer();
  if (!user) return { ok: false, error: SIGNED_OUT_ERROR };
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!(await allowHit(`chat:${user.id}`, 30, 10 * 60 * 1000))) {
    return { ok: false, error: "You're sending messages very fast. Please wait a few minutes." };
  }

  const text = parsed.data;
  // One statement (conversation upsert + message): every round trip to the DB is felt in a chat.
  const {
    rows: [row],
  } = await db().execute<{ id: string; conversation_id: string; created_at: string | Date }>(sql`
    with c as (
      insert into "conversations" ("user_id", "last_message_at", "last_message_preview", "last_sender", "customer_read_at")
      values (${user.id}, now(), ${preview(text)}, 'customer', now())
      on conflict ("user_id") do update set
        "last_message_at" = now(), "last_message_preview" = excluded."last_message_preview",
        "last_sender" = 'customer', "customer_read_at" = now()
      returning "id"
    )
    insert into "messages" ("conversation_id", "sender", "body", "created_at")
    select "id", 'customer', ${text}, now() from c
    returning "id", "conversation_id", "created_at"`);
  const conversationId = row.conversation_id;
  const message: ChatMessage = { id: row.id, sender: "customer", body: text, createdAt: new Date(row.created_at).toISOString() };

  after(() =>
    Promise.all([
      signalConversation(conversationId),
      notifyAdminsGrouped({
        type: "feedback",
        title: `Message from ${user.name}`,
        body: preview(text),
        href: `/admin/feedback/${conversationId}`,
      }),
    ]),
  );
  return { ok: true, data: { conversationId, message } };
}

/**
 * New messages since `since` (all, without it). `seen`: the chat is on screen,
 * so the store's replies count as read.
 */
export async function fetchMyMessages(
  since: unknown,
  seen: unknown,
): Promise<ActionResult<{ conversationId: string | null; messages: ChatMessage[] }>> {
  const user = await currentCustomer();
  if (!user) return { ok: false, error: SIGNED_OUT_ERROR };
  const parsedSince = z.iso.datetime().safeParse(since);
  const { conversationId, messages } = await listMyMessages(user.id, parsedSince.success ? new Date(parsedSince.data) : undefined);
  if (seen === true) {
    const markRead = () => db().update(s.conversations).set({ customerReadAt: new Date() }).where(eq(s.conversations.userId, user.id));
    if (parsedSince.success) {
      after(markRead); // live updates: marking read doesn't hold up the new messages
    } else {
      // Opening the chat: read now, and refresh the account pages' cached "new" badge.
      await markRead();
      revalidatePath("/account", "layout");
    }
  }
  return { ok: true, data: { conversationId, messages } };
}

/**
 * Unread replies from the store (for the site-wide toast). When it changed
 * from `previous`, the account pages' cached "new" badge is refreshed.
 */
export async function fetchMyUnreadCount(previous?: unknown): Promise<number> {
  const user = await currentCustomer();
  if (!user) return 0;
  const { unread } = await getMyUnreadReplies(user.id);
  if (typeof previous === "number" && unread !== previous) revalidatePath("/account", "layout");
  return unread;
}

/** For the store-wide reply watcher: the signed-in customer's conversation, if any. */
export async function fetchMyChatWatch(): Promise<{ conversationId: string; unread: number } | null> {
  const user = await currentCustomer();
  if (!user) return null;
  const { conversationId, unread } = await getMyUnreadReplies(user.id);
  return conversationId ? { conversationId, unread } : null;
}
