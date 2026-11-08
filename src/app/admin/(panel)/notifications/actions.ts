"use server";

import { inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema as s } from "@/lib/db";
import { listNotifications, type AdminNotification } from "@/lib/data/notifications";
import type { ActionResult } from "@/lib/actions";

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
