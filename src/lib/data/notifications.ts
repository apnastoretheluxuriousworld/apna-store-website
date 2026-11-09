import "server-only";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { pushToAdmins } from "@/lib/push/server";
import { signalAdmins } from "@/lib/realtime/server";

export type NotificationType = (typeof s.notificationType.enumValues)[number];
export type NewNotification = { type: NotificationType; title: string; body?: string | null; href: string };

export type AdminNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string;
  read: boolean;
  createdAt: string; // ISO
};

export const NOTIFICATIONS_LIMIT = 50;
const KEEP_DAYS = 90;

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

/**
 * Save a notification. Pass `tx` to write it in the same transaction as the
 * order/review; then call signalAdmins() after the commit.
 */
export async function addNotification(n: NewNotification, tx?: Tx) {
  const d = tx ?? db();
  await d.insert(s.adminNotifications).values({ type: n.type, title: n.title, body: n.body ?? null, href: n.href });
  // Prune now and then, so the table stays small without a cron job.
  if (Math.random() < 0.05) {
    await d.delete(s.adminNotifications).where(lt(s.adminNotifications.createdAt, sql`now() - make_interval(days => ${KEEP_DAYS})`));
  }
}

/** Tell open admin screens + push to the admin's phones. Call after the notification is saved (committed). */
export async function announceToAdmins(n: NewNotification) {
  await Promise.all([signalAdmins(), pushToAdmins(n)]);
}

/** Save + tell open admin screens + phones. Never throws: a notification must not fail a customer's order or review. */
export async function notifyAdmins(n: NewNotification) {
  try {
    await addNotification(n);
    await announceToAdmins(n);
  } catch (e) {
    console.error("[notifyAdmins]", e);
  }
}

export { signalAdmins };

/**
 * Like notifyAdmins, but while an earlier one for the same page is still
 * unread it's updated (newest text, moved to the top) instead of adding
 * another, e.g. several chat messages in a row → one notification.
 */
export async function notifyAdminsGrouped(n: NewNotification) {
  try {
    const [updated] = await db()
      .update(s.adminNotifications)
      .set({ title: n.title, body: n.body ?? null, createdAt: new Date() })
      .where(and(eq(s.adminNotifications.href, n.href), isNull(s.adminNotifications.readAt)))
      .returning({ id: s.adminNotifications.id });
    if (!updated) await addNotification(n);
    await announceToAdmins(n); // same href → same push tag: the phone shows one notification per chat
  } catch (e) {
    console.error("[notifyAdminsGrouped]", e);
  }
}

/** The admin opened that page (e.g. the chat): its notifications are read. */
export async function markNotificationsReadFor(href: string) {
  await db()
    .update(s.adminNotifications)
    .set({ readAt: new Date() })
    .where(and(eq(s.adminNotifications.href, href), isNull(s.adminNotifications.readAt)));
}

/** Newest first. `since`: only those created after it (for live updates). */
export async function listNotifications(since?: Date) {
  const d = db();
  const [rows, [{ unread }]] = await Promise.all([
    d
      .select()
      .from(s.adminNotifications)
      .where(since ? gt(s.adminNotifications.createdAt, since) : undefined)
      .orderBy(desc(s.adminNotifications.createdAt))
      .limit(NOTIFICATIONS_LIMIT),
    d.select({ unread: sql<number>`count(*)::int` }).from(s.adminNotifications).where(isNull(s.adminNotifications.readAt)),
  ]);
  return {
    unread,
    items: rows.map(
      (r): AdminNotification => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        href: r.href,
        read: !!r.readAt,
        createdAt: r.createdAt.toISOString(),
      }),
    ),
  };
}
