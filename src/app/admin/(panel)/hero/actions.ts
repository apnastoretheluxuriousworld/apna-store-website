"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { warmStore } from "@/lib/warm";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema as s } from "@/lib/db";
import { HERO_TAG } from "@/lib/data/hero";
import { deleteUnreferencedUploads } from "@/lib/storage/cleanup";
import { heroSlideInputSchema } from "@/lib/validation/hero";
import { zodFieldErrors, type ActionResult } from "@/lib/actions";

/** Refresh the homepage and the admin's client cache. */
function heroChanged() {
  updateTag(HERO_TAG);
  warmStore(); // rebuild the store pages' cache in the background
  revalidatePath("/admin", "layout");
}

/**
 * Create or update a hero banner. The id always comes from the client: an id we
 * don't know yet means "create with this id", so outbox retries never duplicate.
 */
export async function saveHeroSlide(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = heroSlideInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  const { id, imageUrl, ...t } = parsed.data;
  const row = {
    mediaType: "image" as const,
    mediaUrl: imageUrl,
    title: t.title,
    eyebrow: t.eyebrow || null,
    highlight: t.highlight || null,
    subtitle: t.subtitle || null,
    ctaLabel: t.ctaLabel || null,
    ctaHref: t.ctaHref || null,
    isActive: t.isActive,
  };

  const d = db();
  try {
    const [before] = await d.select().from(s.heroSlides).where(eq(s.heroSlides.id, id));
    if (before) {
      await d.update(s.heroSlides).set(row).where(eq(s.heroSlides.id, id));
      if (before.mediaUrl !== row.mediaUrl) await deleteUnreferencedUploads([before.mediaUrl]);
    } else {
      // New banners go first.
      await d.transaction(async (tx) => {
        await tx.update(s.heroSlides).set({ sortOrder: sql`${s.heroSlides.sortOrder} + 1` });
        await tx.insert(s.heroSlides).values({ ...row, id, sortOrder: 0 }).onConflictDoNothing({ target: s.heroSlides.id });
      });
    }
    heroChanged();
    return { ok: true, data: { id } };
  } catch (e) {
    console.error("[saveHeroSlide]", e);
    return { ok: false, error: "Couldn't save the banner. Please try again." };
  }
}

const idSchema = z.uuid();

export async function deleteHeroSlide(id: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid banner." };
  const [gone] = await db().delete(s.heroSlides).where(eq(s.heroSlides.id, parsed.data)).returning();
  if (gone) await deleteUnreferencedUploads([gone.mediaUrl, gone.mobileMediaUrl, gone.posterUrl]);
  heroChanged();
  return { ok: true };
}

export async function setHeroSlideActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success || typeof isActive !== "boolean") return { ok: false, error: "Invalid request." };
  await db().update(s.heroSlides).set({ isActive }).where(eq(s.heroSlides.id, id));
  heroChanged();
  return { ok: true };
}

export async function reorderHeroSlides(ids: string[]): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.array(z.uuid()).max(500).safeParse(ids);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) return { ok: false, error: "Invalid order." };
  await db().transaction(async (tx) => {
    for (const [i, id] of parsed.data.entries()) {
      await tx.update(s.heroSlides).set({ sortOrder: i }).where(eq(s.heroSlides.id, id));
    }
  });
  heroChanged();
  return { ok: true };
}
