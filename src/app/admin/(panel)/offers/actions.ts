"use server";

import { and, eq, inArray, like, ne, or, sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { warmStore } from "@/lib/warm";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema as s } from "@/lib/db";
import { OFFERS_TAG } from "@/lib/data/offers";
import { deleteUnreferencedUploads } from "@/lib/storage/cleanup";
import { slugify } from "@/lib/validation/category";
import { istDayEnd, istDayStart } from "@/lib/validation/coupon";
import { offerInputSchema } from "@/lib/validation/offer";
import { pgCode, zodFieldErrors, type ActionResult } from "@/lib/actions";

/** Refresh the homepage strip, the offer pages and the admin's client cache. */
function offersChanged() {
  updateTag(OFFERS_TAG);
  warmStore(); // rebuild the store pages' cache in the background
  revalidatePath("/admin", "layout");
}

type Db = ReturnType<typeof db>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** A free /offers/<slug> made from the title ("any-3-for-1000", "any-3-for-1000-2"…). */
async function freeSlug(tx: Tx, title: string, id: string) {
  const base = slugify(title, 50) || "offer";
  const taken = await tx
    .select({ slug: s.offers.slug })
    .from(s.offers)
    .where(and(ne(s.offers.id, id), or(eq(s.offers.slug, base), like(s.offers.slug, `${base}-%`))));
  const used = new Set(taken.map((t) => t.slug));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

/**
 * Create or update an offer. The id always comes from the client: an id we
 * don't know yet means "create with this id", so outbox retries never duplicate.
 * The page address (/offers/<slug>) is made from the title once and then kept,
 * so links shared on WhatsApp keep working after the title is edited.
 */
export async function saveOffer(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = offerInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  const { id, productIds, startsOn, endsOn, description, ...v } = parsed.data;
  const row = {
    ...v,
    description: description || null,
    startsAt: startsOn ? istDayStart(startsOn) : null,
    expiresAt: endsOn ? istDayEnd(endsOn) : null,
  };

  const d = db();
  try {
    const known = await d.select({ id: s.products.id }).from(s.products).where(inArray(s.products.id, productIds));
    const ids = productIds.filter((p) => known.some((k) => k.id === p));
    if (!ids.length) return { ok: false, error: "Those products no longer exist. Choose others.", fieldErrors: { productIds: "Choose the products in this offer" } };

    let oldCover: string | null = null;
    await d.transaction(async (tx) => {
      const [before] = await tx.select({ coverUrl: s.offers.coverUrl }).from(s.offers).where(eq(s.offers.id, id)).for("update");
      if (before) {
        oldCover = before.coverUrl;
        await tx.update(s.offers).set(row).where(eq(s.offers.id, id));
      } else {
        // New offers go first.
        await tx.update(s.offers).set({ sortOrder: sql`${s.offers.sortOrder} + 1` });
        await tx.insert(s.offers).values({ ...row, id, slug: await freeSlug(tx, row.title, id), sortOrder: 0 });
      }
      await tx.delete(s.offerProducts).where(eq(s.offerProducts.offerId, id));
      await tx.insert(s.offerProducts).values(ids.map((productId, i) => ({ offerId: id, productId, sortOrder: i })));
    });
    if (oldCover && oldCover !== row.coverUrl) await deleteUnreferencedUploads([oldCover]);
    offersChanged();
    return { ok: true, data: { id } };
  } catch (e) {
    if (pgCode(e) === "23505") return { ok: false, error: "Couldn't save the offer (its page address clashed). Please try again." };
    console.error("[saveOffer]", e);
    return { ok: false, error: "Couldn't save the offer. Please try again." };
  }
}

const idSchema = z.uuid();

/** Orders keep the offer's name on their items, so any offer can be deleted. */
export async function deleteOffer(id: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid offer." };
  const [gone] = await db().delete(s.offers).where(eq(s.offers.id, parsed.data)).returning({ coverUrl: s.offers.coverUrl });
  if (gone) await deleteUnreferencedUploads([gone.coverUrl]);
  offersChanged();
  return { ok: true };
}

export async function setOfferActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success || typeof isActive !== "boolean") return { ok: false, error: "Invalid request." };
  await db().update(s.offers).set({ isActive }).where(eq(s.offers.id, id));
  offersChanged();
  return { ok: true };
}
