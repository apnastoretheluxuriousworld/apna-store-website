import "server-only";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db, schema as s } from "@/lib/db";

/*
 * Customer feedback: one ongoing chat per signed-in customer with the store.
 * Unread = messages from the other side newer than this side's read marker.
 */

export type ChatSender = "customer" | "admin";
export type ChatMessage = { id: string; sender: ChatSender; body: string; createdAt: string };

export const CHAT_HISTORY_LIMIT = 200;
export const MESSAGE_MAX = 2000;

const toChat = (m: { id: string; sender: ChatSender; body: string; createdAt: Date }): ChatMessage => ({
  id: m.id,
  sender: m.sender,
  body: m.body,
  createdAt: m.createdAt.toISOString(),
});

/** Oldest first. With `since`: only newer ones (live updates). */
export async function listMessages(conversationId: string, since?: Date): Promise<ChatMessage[]> {
  const d = db();
  if (since) {
    const rows = await d
      .select({ id: s.messages.id, sender: s.messages.sender, body: s.messages.body, createdAt: s.messages.createdAt })
      .from(s.messages)
      .where(and(eq(s.messages.conversationId, conversationId), gt(s.messages.createdAt, since)))
      .orderBy(asc(s.messages.createdAt))
      .limit(CHAT_HISTORY_LIMIT);
    return rows.map(toChat);
  }
  // Latest N, returned oldest first.
  const rows = await d
    .select({ id: s.messages.id, sender: s.messages.sender, body: s.messages.body, createdAt: s.messages.createdAt })
    .from(s.messages)
    .where(eq(s.messages.conversationId, conversationId))
    .orderBy(desc(s.messages.createdAt))
    .limit(CHAT_HISTORY_LIMIT);
  return rows.reverse().map(toChat);
}

/**
 * The customer's messages in ONE query (the conversation is looked up inside
 * it), since `since` when given. Each database round trip is felt in a chat.
 */
export async function listMyMessages(userId: string, since?: Date): Promise<{ conversationId: string | null; messages: ChatMessage[] }> {
  const mine = sql`${s.messages.conversationId} = (select c."id" from "conversations" c where c."user_id" = ${userId})`;
  const cols = {
    id: s.messages.id,
    conversationId: s.messages.conversationId,
    sender: s.messages.sender,
    body: s.messages.body,
    createdAt: s.messages.createdAt,
  };
  const rows = since
    ? await db().select(cols).from(s.messages).where(and(mine, gt(s.messages.createdAt, since))).orderBy(asc(s.messages.createdAt)).limit(CHAT_HISTORY_LIMIT)
    : (await db().select(cols).from(s.messages).where(mine).orderBy(desc(s.messages.createdAt)).limit(CHAT_HISTORY_LIMIT)).reverse();
  return { conversationId: rows[0]?.conversationId ?? null, messages: rows.map(toChat) };
}

export async function findConversationId(userId: string): Promise<string | null> {
  const [c] = await db().select({ id: s.conversations.id }).from(s.conversations).where(eq(s.conversations.userId, userId));
  return c?.id ?? null;
}

/* ───────────── Customer ───────────── */

/** The customer's chat for the Feedback page (private-cached like other account pages). */
export async function getMyConversation(userId: string) {
  "use cache: private";
  cacheLife("account");
  const id = await findConversationId(userId);
  return { conversationId: id, messages: id ? await listMessages(id) : [] };
}

/** Replies from the store the customer hasn't seen yet (+ their conversation id, for live updates). */
export async function getMyUnreadReplies(userId: string): Promise<{ conversationId: string | null; unread: number }> {
  const [row] = await db()
    .select({
      id: s.conversations.id,
      unread: sql<number>`(select count(*)::int from "messages" m where m."conversation_id" = "conversations"."id"
        and m."sender" = 'admin' and m."created_at" > coalesce("conversations"."customer_read_at", 'epoch'))`,
    })
    .from(s.conversations)
    .where(eq(s.conversations.userId, userId));
  return { conversationId: row?.id ?? null, unread: row?.unread ?? 0 };
}

/* ───────────── Admin ───────────── */

const adminUnreadSql = sql<number>`(select count(*)::int from "messages" m where m."conversation_id" = "conversations"."id"
  and m."sender" = 'customer' and m."created_at" > coalesce("conversations"."admin_read_at", 'epoch'))`;

export async function listConversationsForAdmin() {
  "use cache: private";
  cacheLife("admin");
  return db()
    .select({
      id: s.conversations.id,
      userId: s.users.id,
      name: s.users.name,
      phone: s.users.phone,
      lastMessageAt: s.conversations.lastMessageAt,
      preview: s.conversations.lastMessagePreview,
      lastSender: s.conversations.lastSender,
      unread: adminUnreadSql,
    })
    .from(s.conversations)
    .innerJoin(s.users, eq(s.users.id, s.conversations.userId))
    .orderBy(desc(s.conversations.lastMessageAt))
    .limit(200);
}

export async function getConversationForAdmin(id: string) {
  "use cache: private";
  cacheLife("admin");
  const [c] = await db()
    .select({
      id: s.conversations.id,
      userId: s.users.id,
      name: s.users.name,
      phone: s.users.phone,
      orders: sql<number>`(select count(*)::int from "orders" o where o."user_id" = "users"."id")`,
    })
    .from(s.conversations)
    .innerJoin(s.users, eq(s.users.id, s.conversations.userId))
    .where(eq(s.conversations.id, id));
  if (!c) return null;
  return { ...c, messages: await listMessages(id) };
}

/** Admin menu badge: conversations with customer messages the store hasn't read. */
export async function countUnreadConversations() {
  "use cache: private";
  cacheLife("admin");
  const [row] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(s.conversations)
    .where(sql`${adminUnreadSql} > 0`);
  return row?.n ?? 0;
}
