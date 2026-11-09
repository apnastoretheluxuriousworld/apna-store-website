import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db, schema as s } from "@/lib/db";

/*
 * Web push: native phone/desktop notifications for the admin, even when the
 * admin app is closed. The browser's push service (Google FCM, Apple, Mozilla)
 * delivers them; we only need the VAPID key pair from .env.
 * Without the keys, push is simply off (the in-app list + toast still work).
 */

export type PushPayload = {
  title: string;
  body?: string | null;
  /** Admin page to open when the notification is tapped. */
  href: string;
  /** Same tag → replaces the earlier notification on the device (e.g. one per chat). */
  tag?: string;
};

function vapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  let subject = process.env.VAPID_SUBJECT?.trim();
  if (!subject) {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    // Apple rejects localhost / http subjects.
    subject = site.startsWith("https://") ? site : "mailto:admin@apnastore.invalid";
  }
  return { publicKey, privateKey, subject };
}

/** Public key for the browser's subscribe() call, or null when push isn't configured. */
export const vapidPublicKey = () => vapid()?.publicKey ?? null;

export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function savePushSubscription(userId: string, sub: PushSubscriptionInput, device: string | null) {
  await db()
    .insert(s.pushSubscriptions)
    .values({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, device })
    .onConflictDoUpdate({
      target: s.pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, device },
    });
}

export async function deletePushSubscription(userId: string, endpoint: string) {
  await db()
    .delete(s.pushSubscriptions)
    .where(and(eq(s.pushSubscriptions.userId, userId), eq(s.pushSubscriptions.endpoint, endpoint)));
}

type Sub = { endpoint: string; p256dh: string; auth: string };

/** Send to these devices; drops the ones the push service says are gone (404/410). Returns how many got it. */
async function sendTo(subs: Sub[], p: PushPayload) {
  const keys = vapid();
  if (!keys || !subs.length) return 0;
  const payload = JSON.stringify({ title: p.title, body: p.body ?? "", href: p.href, tag: p.tag ?? p.href });
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
          vapidDetails: keys,
          TTL: 60 * 60 * 24, // phone off for over a day → drop it
          urgency: "high",
          timeout: 5000,
        });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(sub.endpoint);
        else console.warn("[push] send failed", status ?? (e instanceof Error ? e.message : e));
      }
    }),
  );
  if (gone.length) await db().delete(s.pushSubscriptions).where(inArray(s.pushSubscriptions.endpoint, gone));
  return sent;
}

const subColumns = { endpoint: s.pushSubscriptions.endpoint, p256dh: s.pushSubscriptions.p256dh, auth: s.pushSubscriptions.auth };

/** Send to every admin device. Never throws: a failed push must not fail an order or review. */
export async function pushToAdmins(p: PushPayload) {
  if (!vapid()) return;
  try {
    const subs = await db()
      .select(subColumns)
      .from(s.pushSubscriptions)
      .innerJoin(s.users, eq(s.users.id, s.pushSubscriptions.userId))
      .where(eq(s.users.role, "admin"));
    await sendTo(subs, p);
  } catch (e) {
    console.error("[pushToAdmins]", e);
  }
}

/** Test notification to one of this user's own devices. */
export async function pushTest(userId: string, endpoint: string) {
  const subs = await db()
    .select(subColumns)
    .from(s.pushSubscriptions)
    .where(and(eq(s.pushSubscriptions.userId, userId), eq(s.pushSubscriptions.endpoint, endpoint)));
  return sendTo(subs, { title: "Notifications are on ✓", body: "New orders, payments, reviews and messages will show up like this.", href: "/admin/notifications", tag: "test" });
}
