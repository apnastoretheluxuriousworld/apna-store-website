"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { changePassword, deleteUserSessions } from "@/lib/auth/core";
import { HashBusy } from "@/lib/auth/password";
import { currentSessionToken, requireAdmin } from "@/lib/auth/session";
import { changeAdminPasswordSchema } from "@/lib/validation/admin-password";
import { db, schema as s } from "@/lib/db";
import { SETTINGS_TAG } from "@/lib/data/settings";
import { storeInfoSchema } from "@/lib/validation/settings";
import { paymentSettingsSchema } from "@/lib/validation/checkout";
import { deleteUnreferencedUploads } from "@/lib/storage/cleanup";
import { zodFieldErrors, type ActionResult } from "@/lib/actions";

/** Save store details (footer + Contact page). Keeps the store's name/tagline in the same row. */
export async function saveStoreInfo(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = storeInfoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  const { whatsapp, ...store } = parsed.data;
  const d = db();
  try {
    const [current] = await d.select().from(s.settings).where(eq(s.settings.key, "store"));
    const value = { ...((current?.value as object) ?? {}), ...store, configured: true };
    await d.transaction(async (tx) => {
      for (const [key, v] of [["store", value], ["whatsapp_number", whatsapp]] as const) {
        await tx
          .insert(s.settings)
          .values({ key, value: v })
          .onConflictDoUpdate({ target: s.settings.key, set: { value: v, updatedAt: new Date() } });
      }
    });
    updateTag(SETTINGS_TAG);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    console.error("[saveStoreInfo]", e);
    return { ok: false, error: "Couldn't save the store details. Please try again." };
  }
}

/** Payments & delivery: UPI QR, COD rules, shipping fee (used at checkout). */
export async function savePaymentSettings(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = paymentSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  const value = parsed.data;
  const d = db();
  try {
    const [current] = await d.select().from(s.settings).where(eq(s.settings.key, "payments"));
    await d
      .insert(s.settings)
      .values({ key: "payments", value })
      .onConflictDoUpdate({ target: s.settings.key, set: { value, updatedAt: new Date() } });
    const oldQr = (current?.value as { qrUrl?: string } | undefined)?.qrUrl;
    if (oldQr && oldQr !== value.qrUrl) await deleteUnreferencedUploads([oldQr]);
    updateTag(SETTINGS_TAG);
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (e) {
    console.error("[savePaymentSettings]", e);
    return { ok: false, error: "Couldn't save the payment settings. Please try again." };
  }
}

/**
 * Admin → Settings → Password. Not an optimistic/outbox save: the current
 * password has to be checked on the server first, so the form waits for this.
 * Rate limited (5 wrong tries per 15 min, same counter as customers' PIN change).
 * A new password signs the admin out on every other device, not this one.
 */
export async function changeAdminPassword(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = changeAdminPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  try {
    const res = await changePassword(db(), { userId: admin.id, current: parsed.data.current, next: parsed.data.next });
    if (!res.ok) {
      return res.reason === "locked"
        ? { ok: false, error: "Too many wrong attempts. Please wait 15 minutes and try again." }
        : { ok: false, error: "Your current password is incorrect.", fieldErrors: { current: "Incorrect password" } };
    }
    await deleteUserSessions(db(), admin.id, await currentSessionToken());
    return { ok: true };
  } catch (e) {
    if (e instanceof HashBusy) return { ok: false, error: "The server is busy. Please try again in a moment." };
    console.error("[changeAdminPassword]", e instanceof Error ? e.message : e);
    return { ok: false, error: "Couldn't change the password. Please try again." };
  }
}
