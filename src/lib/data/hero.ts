import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema as s } from "@/lib/db";

/** Hero actions call updateTag(HERO_TAG) to refresh the homepage. */
export const HERO_TAG = "hero";

/** One slide of the homepage hero carousel. */
export type HeroSlide = {
  key: string;
  image: string;
  eyebrow: string;
  title: string;
  /** Italic gold line under the title. */
  highlight: string;
  subtitle: string;
  ctaLabel: string;
  /** "" = no button. */
  ctaHref: string;
};

const order = [asc(s.heroSlides.sortOrder), desc(s.heroSlides.createdAt)];

/**
 * Homepage hero: the visible banners in the admin's order (the starter set has
 * one per collection — see seedCollectionHeroSlides). [] when there are none or
 * the DB is unreachable — the hero then shows its built-in brand slide.
 */
export async function getHeroSlides(): Promise<HeroSlide[]> {
  "use cache";
  cacheTag(HERO_TAG);
  try {
    const banners = await db().select().from(s.heroSlides).where(eq(s.heroSlides.isActive, true)).orderBy(...order);
    const slides: HeroSlide[] = banners.map((b) => ({
      key: b.id,
      image: b.mediaUrl,
      eyebrow: b.eyebrow ?? "",
      title: b.title,
      highlight: b.highlight ?? "",
      subtitle: b.subtitle ?? "",
      ctaLabel: b.ctaLabel ?? "",
      ctaHref: b.ctaHref ?? "",
    }));
    cacheLife("store");
    return slides;
  } catch (e) {
    console.warn("[hero] slides query failed:", e instanceof Error ? e.message : e);
    cacheLife("minutes");
    return [];
  }
}

/* ───────────── Admin (private-cached; call after requireAdminView()) ───────────── */

function toAdminRow(r: typeof s.heroSlides.$inferSelect) {
  return {
    id: r.id,
    imageUrl: r.mediaUrl,
    eyebrow: r.eyebrow ?? "",
    title: r.title,
    highlight: r.highlight ?? "",
    subtitle: r.subtitle ?? "",
    ctaLabel: r.ctaLabel ?? "",
    ctaHref: r.ctaHref ?? "",
    isActive: r.isActive,
  };
}

export type AdminHeroRow = ReturnType<typeof toAdminRow>;

export async function listHeroForAdmin() {
  "use cache: private";
  cacheLife("admin");
  const rows = await db().select().from(s.heroSlides).orderBy(...order);
  return rows.map(toAdminRow);
}

export async function getHeroSlideForEdit(id: string): Promise<AdminHeroRow | null> {
  "use cache: private";
  cacheLife("admin");
  const [r] = await db().select().from(s.heroSlides).where(eq(s.heroSlides.id, id));
  return r ? toAdminRow(r) : null;
}
