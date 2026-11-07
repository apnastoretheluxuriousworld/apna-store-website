"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema as s } from "@/lib/db";
import type { ReviewMedia } from "@/lib/db/schema";
import { REVIEWS_TAG } from "@/lib/data/reviews";
import { deleteUnreferencedUploads } from "@/lib/storage/cleanup";
import type { ActionResult } from "@/lib/actions";

/** Refresh the storefront (reviews + card ratings) and the admin's client cache. */
function reviewsChanged() {
  updateTag(REVIEWS_TAG);
  revalidatePath("/admin", "layout");
}

const mediaUrls = (media: ReviewMedia[]) => media.flatMap((m) => [m.url, m.poster]);

/*
 * Reviews are written by customers on the storefront (with customer accounts).
 * The admin only moderates: publish/hide, pin, delete.
 */

const idSchema = z.uuid();

export async function deleteReview(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid review." };
  const [gone] = await db().delete(s.reviews).where(eq(s.reviews.id, id)).returning({ media: s.reviews.media });
  if (gone) await deleteUnreferencedUploads(mediaUrls(gone.media));
  reviewsChanged();
  return { ok: true };
}

export async function setReviewApproved(id: string, isApproved: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success || typeof isApproved !== "boolean") return { ok: false, error: "Invalid request." };
  await db().update(s.reviews).set({ isApproved }).where(eq(s.reviews.id, id));
  reviewsChanged();
  return { ok: true };
}

export async function setReviewPinned(id: string, isPinned: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success || typeof isPinned !== "boolean") return { ok: false, error: "Invalid request." };
  await db().update(s.reviews).set({ isPinned }).where(eq(s.reviews.id, id));
  reviewsChanged();
  return { ok: true };
}
