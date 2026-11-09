import "server-only";
import { inArray, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { deleteUploads } from "./index";

/** Every column that can point at an uploaded file. */
async function referencedUrls(urls: string[]) {
  const d = db();
  const rows = (
    await Promise.all([
      d.select({ a: s.categories.imageUrl }).from(s.categories).where(inArray(s.categories.imageUrl, urls)),
      d.select({ a: s.productImages.url }).from(s.productImages).where(inArray(s.productImages.url, urls)),
      d.select({ a: s.orderItems.imageUrl }).from(s.orderItems).where(inArray(s.orderItems.imageUrl, urls)),
      d.select({ a: s.orders.paymentProofUrl }).from(s.orders).where(inArray(s.orders.paymentProofUrl, urls)),
      // The store's UPI QR (Settings → Payments).
      d
        .select({ a: sql<string | null>`${s.settings.value}->>'qrUrl'` })
        .from(s.settings)
        .where(sql`${s.settings.key} = 'payments' and ${s.settings.value}->>'qrUrl' in (${sql.join(urls.map((u) => sql`${u}`), sql`, `)})`),
      d
        .select({ a: s.heroSlides.mediaUrl, b: s.heroSlides.mobileMediaUrl, c: s.heroSlides.posterUrl })
        .from(s.heroSlides)
        .where(or(inArray(s.heroSlides.mediaUrl, urls), inArray(s.heroSlides.mobileMediaUrl, urls), inArray(s.heroSlides.posterUrl, urls))),
      d.select({ a: s.offers.coverUrl }).from(s.offers).where(inArray(s.offers.coverUrl, urls)),
      d
        .select({ a: s.reels.videoUrl, b: s.reels.posterUrl })
        .from(s.reels)
        .where(or(inArray(s.reels.videoUrl, urls), inArray(s.reels.posterUrl, urls))),
      d
        .select({ a: s.testimonials.mediaUrl, b: s.testimonials.posterUrl })
        .from(s.testimonials)
        .where(or(inArray(s.testimonials.mediaUrl, urls), inArray(s.testimonials.posterUrl, urls))),
      // Review photos/videos live in a jsonb array: [{ type, url, poster }].
      d
        .select({ a: sql<string | null>`m->>'url'`, b: sql<string | null>`m->>'poster'` })
        .from(sql`${s.reviews}, jsonb_array_elements(${s.reviews.media}) m`)
        .where(
          sql`m->>'url' in (${sql.join(urls.map((u) => sql`${u}`), sql`, `)}) or m->>'poster' in (${sql.join(urls.map((u) => sql`${u}`), sql`, `)})`,
        ),
    ])
  ).flat() as Record<string, string | null>[];

  return new Set(rows.flatMap((r) => Object.values(r)).filter((u): u is string => !!u));
}

/**
 * Delete uploaded files that nothing in the database points at any more.
 * Best-effort: never throws, so a storage hiccup can't fail a save.
 */
export async function deleteUnreferencedUploads(urls: (string | null | undefined)[]) {
  const list = [...new Set(urls.filter((u): u is string => !!u))];
  if (!list.length) return 0;
  try {
    const used = await referencedUrls(list);
    return await deleteUploads(list.filter((u) => !used.has(u)));
  } catch (e) {
    console.warn("[storage] cleanup failed", e instanceof Error ? e.message : e);
    return 0;
  }
}
