"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
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
