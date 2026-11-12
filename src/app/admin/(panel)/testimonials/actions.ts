"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { warmStore } from "@/lib/warm";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema as s } from "@/lib/db";
import { TESTIMONIALS_TAG } from "@/lib/data/testimonials";
import { deleteUnreferencedUploads } from "@/lib/storage/cleanup";
import { testimonialInputSchema } from "@/lib/validation/testimonial";
import { zodFieldErrors, type ActionResult } from "@/lib/actions";

/** Refresh the homepage and the admin's client cache. */
function testimonialsChanged() {
  updateTag(TESTIMONIALS_TAG);
  warmStore(); // rebuild the store pages' cache in the background
  revalidatePath("/admin", "layout");
}

export async function saveTestimonial(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = testimonialInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  const { id, media, ...data } = parsed.data;
  const m = media[0];
  const row = {
    ...data,
    city: data.city || null,
    body: data.body || null,
    mediaType: m?.type ?? null,
    mediaUrl: m?.url ?? null,
    posterUrl: m?.type === "video" ? (m.poster ?? null) : null,
  };

  const d = db();
  try {
    if (id) {
      const [before] = await d.select().from(s.testimonials).where(eq(s.testimonials.id, id));
      if (!before) return { ok: false, error: "This testimonial no longer exists." };
      await d.update(s.testimonials).set(row).where(eq(s.testimonials.id, id));
      const keep = new Set([row.mediaUrl, row.posterUrl]);
      await deleteUnreferencedUploads([before.mediaUrl, before.posterUrl].filter((u) => u && !keep.has(u)));
      testimonialsChanged();
      return { ok: true, data: { id } };
    }
    // New ones go to the front of the carousel.
    const [created] = await d.transaction(async (tx) => {
      await tx.update(s.testimonials).set({ sortOrder: sql`${s.testimonials.sortOrder} + 1` });
      return tx.insert(s.testimonials).values({ ...row, sortOrder: 0 }).returning({ id: s.testimonials.id });
    });
    testimonialsChanged();
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    console.error("[saveTestimonial]", e);
    return { ok: false, error: "Couldn't save the testimonial. Please try again." };
  }
}

const idSchema = z.uuid();

export async function deleteTestimonial(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid testimonial." };
  const [gone] = await db().delete(s.testimonials).where(eq(s.testimonials.id, id)).returning();
  if (gone) await deleteUnreferencedUploads([gone.mediaUrl, gone.posterUrl]);
  testimonialsChanged();
  return { ok: true };
}

export async function setTestimonialActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success || typeof isActive !== "boolean") return { ok: false, error: "Invalid request." };
  await db().update(s.testimonials).set({ isActive }).where(eq(s.testimonials.id, id));
  testimonialsChanged();
  return { ok: true };
}

export async function reorderTestimonials(ids: string[]): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.array(z.uuid()).max(500).safeParse(ids);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) return { ok: false, error: "Invalid order." };
  await db().transaction(async (tx) => {
    for (const [i, id] of parsed.data.entries()) {
      await tx.update(s.testimonials).set({ sortOrder: i }).where(eq(s.testimonials.id, id));
    }
  });
  testimonialsChanged();
  return { ok: true };
}
