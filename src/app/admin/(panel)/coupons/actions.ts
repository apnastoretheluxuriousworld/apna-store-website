"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema as s } from "@/lib/db";
import { couponInputSchema, istDayEnd, istDayStart } from "@/lib/validation/coupon";
import { pgCode, zodFieldErrors, type ActionResult } from "@/lib/actions";

/** Coupons are read live at checkout (never cached), so only the admin needs refreshing. */
const couponsChanged = () => revalidatePath("/admin", "layout");

/**
 * Create or update a coupon. The id always comes from the client: an id we don't
 * know yet means "create with this id", so outbox retries never duplicate.
 */
export async function saveCoupon(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = couponInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  const { id, startsOn, endsOn, influencerId, note, ...v } = parsed.data;
  const row = {
    ...v,
    maxDiscount: v.type === "percent" ? v.maxDiscount : null,
    influencerId: influencerId || null,
    note: note || null,
    startsAt: startsOn ? istDayStart(startsOn) : null,
    expiresAt: endsOn ? istDayEnd(endsOn) : null,
  };

  const d = db();
  try {
    const [clash] = await d
      .select({ id: s.coupons.id })
      .from(s.coupons)
      .where(and(eq(s.coupons.code, row.code), ne(s.coupons.id, id)));
    if (clash) return { ok: false, error: `${row.code} is already taken`, fieldErrors: { code: "Another coupon already uses this code" } };
    await d
      .insert(s.coupons)
      .values({ id, ...row })
      .onConflictDoUpdate({ target: s.coupons.id, set: row });
    couponsChanged();
    return { ok: true, data: { id } };
  } catch (e) {
    if (pgCode(e) === "23505") {
      return { ok: false, error: `${row.code} is already taken`, fieldErrors: { code: "Another coupon already uses this code" } };
    }
    if (pgCode(e) === "23503") return { ok: false, error: "That influencer no longer exists. Choose another." };
    console.error("[saveCoupon]", e);
    return { ok: false, error: "Couldn't save the coupon. Please try again." };
  }
}

const idSchema = z.uuid();

/** Only coupons no order has used can be deleted (orders keep their history); others are switched off instead. */
export async function deleteCoupon(id: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid coupon." };
  const d = db();
  const [used] = await d.select({ n: sql<number>`count(*)::int` }).from(s.orders).where(eq(s.orders.couponId, parsed.data));
  if (used && used.n > 0) {
    return { ok: false, error: `It's on ${used.n} order${used.n > 1 ? "s" : ""}, so it can't be deleted. Switch it off instead.` };
  }
  await d.delete(s.coupons).where(eq(s.coupons.id, parsed.data));
  couponsChanged();
  return { ok: true };
}

export async function setCouponActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success || typeof isActive !== "boolean") return { ok: false, error: "Invalid request." };
  await db().update(s.coupons).set({ isActive }).where(eq(s.coupons.id, id));
  couponsChanged();
  return { ok: true };
}
