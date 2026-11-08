"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema as s } from "@/lib/db";
import { influencerInputSchema } from "@/lib/validation/coupon";
import { zodFieldErrors, type ActionResult } from "@/lib/actions";

const influencersChanged = () => revalidatePath("/admin", "layout");

/** Create or update (the id comes from the client, so outbox retries never duplicate). */
export async function saveInfluencer(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = influencerInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  const { id, ...v } = parsed.data;
  const row = { ...v, handle: v.handle || null, phone: v.phone || null, notes: v.notes || null };
  try {
    await db()
      .insert(s.influencers)
      .values({ id, ...row })
      .onConflictDoUpdate({ target: s.influencers.id, set: row });
    influencersChanged();
    return { ok: true, data: { id } };
  } catch (e) {
    console.error("[saveInfluencer]", e);
    return { ok: false, error: "Couldn't save. Please try again." };
  }
}

const idSchema = z.uuid();

/**
 * Only someone with no orders yet can be deleted (their sales and commission
 * history stays otherwise). Their coupons stay, without an influencer.
 */
export async function deleteInfluencer(id: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid influencer." };
  const d = db();
  const [used] = await d.select({ n: sql<number>`count(*)::int` }).from(s.orders).where(eq(s.orders.influencerId, parsed.data));
  if (used && used.n > 0) {
    return { ok: false, error: `They have ${used.n} order${used.n > 1 ? "s" : ""}, so they can't be deleted. Switch them off instead.` };
  }
  await d.delete(s.influencers).where(eq(s.influencers.id, parsed.data));
  influencersChanged();
  return { ok: true };
}

export async function setInfluencerActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success || typeof isActive !== "boolean") return { ok: false, error: "Invalid request." };
  await db().update(s.influencers).set({ isActive }).where(eq(s.influencers.id, id));
  influencersChanged();
  return { ok: true };
}
