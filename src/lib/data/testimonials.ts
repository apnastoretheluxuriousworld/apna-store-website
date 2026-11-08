import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema as s } from "@/lib/db";
import type { ReviewMedia } from "@/lib/db/schema";

/** Testimonial actions call updateTag(TESTIMONIALS_TAG) to refresh the homepage. */
export const TESTIMONIALS_TAG = "testimonials";

export type StoreTestimonial = {
  id: string;
  name: string;
  city: string | null;
  body: string | null;
  rating: number;
  media: ReviewMedia | null;
};

type Row = typeof s.testimonials.$inferSelect;

export function testimonialMedia(t: Pick<Row, "mediaType" | "mediaUrl" | "posterUrl">): ReviewMedia | null {
  return t.mediaType && t.mediaUrl ? { type: t.mediaType, url: t.mediaUrl, poster: t.posterUrl } : null;
}

/** Visible testimonials for the homepage, in the admin's order. */
export async function getStoreTestimonials(): Promise<StoreTestimonial[]> {
  "use cache";
  cacheTag(TESTIMONIALS_TAG);
  cacheLife("store");
  const rows = await db()
    .select()
    .from(s.testimonials)
    .where(eq(s.testimonials.isActive, true))
    .orderBy(asc(s.testimonials.sortOrder), desc(s.testimonials.createdAt));
  return rows.map((t) => ({ id: t.id, name: t.name, city: t.city, body: t.body, rating: t.rating, media: testimonialMedia(t) }));
}

/* ───────────── Admin (private-cached; call after requireAdminView()) ───────────── */

export async function listTestimonialsForAdmin() {
  "use cache: private";
  cacheLife("admin");
  const rows = await db()
    .select()
    .from(s.testimonials)
    .orderBy(asc(s.testimonials.sortOrder), desc(s.testimonials.createdAt));
  return rows.map((t) => ({ id: t.id, name: t.name, city: t.city, body: t.body, rating: t.rating, isActive: t.isActive, media: testimonialMedia(t) }));
}

export type AdminTestimonialRow = Awaited<ReturnType<typeof listTestimonialsForAdmin>>[number];

export async function getTestimonialForEdit(id: string) {
  "use cache: private";
  cacheLife("admin");
  const [t] = await db().select().from(s.testimonials).where(eq(s.testimonials.id, id));
  return t ?? null;
}
