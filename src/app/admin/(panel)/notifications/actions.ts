"use server";

import { inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema as s } from "@/lib/db";
import { listNotifications, type AdminNotification } from "@/lib/data/notifications";
import type { ActionResult } from "@/lib/actions";
import { deletePushSubscription, pushTest, savePushSubscription } from "@/lib/push/server";

/** Latest notifications + unread count. With `since` (live check), only newer ones. */
export async function fetchNotifications(since?: unknown): Promise<ActionResult<{ unread: number; items: AdminNotification[] }>> {
  await requireAdmin();
  const parsed = z.iso.datetime().optional().safeParse(since ?? undefined);
  const after = parsed.success && parsed.data ? new Date(parsed.data) : undefined;
  try {
    return { ok: true, data: await listNotifications(after) };
  } catch (e) {
    console.error("[fetchNotifications]", e);
    return { ok: false, error: "Couldn't load notifications." };
  }
}

/**
 * After news arrives (called once the toast is up): drop the admin's cached
 * pages, so e.g. a new order shows in Orders right away.
 */
export async function refreshAdminPages(): Promise<void> {
  await requireAdmin();
  revalidatePath("/admin", "layout");
}

const idsSchema = z.union([z.literal("all"), z.array(z.uuid()).max(100)]);

export async function markNotificationsRead(ids: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const now = new Date();
  await db()
    .update(s.adminNotifications)
    .set({ readAt: now })
    .where(parsed.data === "all" ? isNull(s.adminNotifications.readAt) : inArray(s.adminNotifications.id, parsed.data));
  return { ok: true };
}

/* ── Phone notifications (web push) ── */

const pushSubSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** This device wants notifications: remember its push subscription. */
export async function subscribePush(sub: unknown, device: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = pushSubSchema.safeParse(sub);
  if (!parsed.success) return { ok: false, error: "This browser sent an invalid subscription." };
  const name = typeof device === "string" ? device.slice(0, 80) : null;
  try {
    await savePushSubscription(user.id, parsed.data, name);
    return { ok: true };
  } catch (e) {
    console.error("[subscribePush]", e);
    return { ok: false, error: "Couldn't turn on notifications. Try again." };
  }
}

export async function unsubscribePush(endpoint: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  if (typeof endpoint !== "string" || endpoint.length > 1000) return { ok: false, error: "Invalid request." };
  await deletePushSubscription(user.id, endpoint);
  return { ok: true };
}

export async function sendTestPush(endpoint: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  if (typeof endpoint !== "string" || endpoint.length > 1000) return { ok: false, error: "Invalid request." };
  try {
    const sent = await pushTest(user.id, endpoint);
    return sent ? { ok: true } : { ok: false, error: "This device isn't registered any more. Turn notifications off and on again." };
  } catch (e) {
    console.error("[sendTestPush]", e);
    return { ok: false, error: "Couldn't send the test notification." };
  }
}
