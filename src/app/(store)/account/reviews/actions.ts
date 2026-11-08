"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { SIGNED_OUT_ERROR } from "@/lib/auth/signed-out";
import { db, schema as s } from "@/lib/db";
import { REVIEWS_TAG, canCustomerReview, hasReviewableOrder } from "@/lib/data/reviews";
import { notifyAdmins } from "@/lib/data/notifications";
import { allowHit } from "@/lib/rate-limit";
import { keyFromUrl, storage, UploadRejected, uploadKinds } from "@/lib/storage";
import { deleteUnreferencedUploads } from "@/lib/storage/cleanup";
import { zodFieldErrors, type ActionResult } from "@/lib/actions";
import { customerReviewSchema } from "@/lib/validation/review";

const HOUR = 60 * 60 * 1000;

async function currentCustomer() {
  const user = await getCurrentUser();
  return user?.role === "customer" ? user : null;
}

/** Only files uploaded through getReviewUploadUrl are accepted in a review. */
const isReviewUpload = (url: string | null | undefined) => !url || (keyFromUrl(url)?.startsWith("reviews/") ?? false);

/* ───────────── Uploads ───────────── */

const uploadSchema = z.object({
  contentType: z.enum([...Object.keys(uploadKinds.image.types), ...Object.keys(uploadKinds.video.types)] as [string, ...string[]]),
  size: z.number().int().positive(),
});

/** Presigned upload for a review photo, video or video poster (straight to the bucket). */
export async function getReviewUploadUrl(input: unknown): Promise<ActionResult<{ uploadUrl: string; publicUrl: string }>> {
  const user = await currentCustomer();
  if (!user) return { ok: false, error: SIGNED_OUT_ERROR };
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please choose a photo (JPG, PNG, WebP) or a video (MP4, MOV, WebM)." };
  if (!(await allowHit(`review-upload:${user.id}`, 40, HOUR))) {
    return { ok: false, error: "Too many uploads. Please try again in a while." };
  }
  // Only customers with a shipped/delivered order can review, so only they can upload.
  if (!(await hasReviewableOrder(user.id))) {
    return { ok: false, error: "You can add photos once your order has shipped." };
  }
  try {
    const res = await storage.createUploadUrl({ folder: "reviews", ...parsed.data });
    return { ok: true, data: { uploadUrl: res.uploadUrl, publicUrl: res.publicUrl } };
  } catch (e) {
    if (e instanceof UploadRejected) return { ok: false, error: e.message };
    console.error("[getReviewUploadUrl]", e);
    return { ok: false, error: "Couldn't prepare the upload. Please try again." };
  }
}

/** A photo/video removed before posting: delete it if no review uses it. */
export async function discardReviewUpload(url: unknown): Promise<ActionResult> {
  const user = await currentCustomer();
  if (!user) return { ok: false, error: SIGNED_OUT_ERROR };
  const parsed = z.url().max(2000).safeParse(url);
  if (!parsed.success || !isReviewUpload(parsed.data)) return { ok: false, error: "Invalid file." };
  await deleteUnreferencedUploads([parsed.data]);
  return { ok: true };
}

/* ───────────── Post / edit ───────────── */

/**
 * Create or update the customer's review of a product they bought (order
 * shipped or delivered). Every save waits for the store's approval again.
 */
export async function submitReview(input: unknown): Promise<ActionResult> {
  const user = await currentCustomer();
  if (!user) return { ok: false, error: SIGNED_OUT_ERROR };
  const parsed = customerReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check your review.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  const v = parsed.data;
  if (!v.media.every((m) => isReviewUpload(m.url) && isReviewUpload(m.poster))) {
    return { ok: false, error: "Please upload your photos and video again." };
  }
  if (!(await allowHit(`review:${user.id}`, 20, HOUR))) {
    return { ok: false, error: "Too many attempts. Please try again in a while." };
  }

  const allowed = await canCustomerReview(user.id, v.productId);
  if (!allowed) return { ok: false, error: "You can review this product once your order has shipped." };

  const d = db();
  const mine = and(eq(s.reviews.userId, user.id), eq(s.reviews.productId, v.productId));
  const [before] = await d.select({ media: s.reviews.media }).from(s.reviews).where(mine);

  const fields = {
    authorName: user.name,
    city: allowed.city,
    rating: v.rating,
    body: v.body,
    media: v.media,
    isApproved: false,
    isVerified: true,
  };
  await d
    .insert(s.reviews)
    .values({ productId: v.productId, userId: user.id, ...fields })
    .onConflictDoUpdate({ target: [s.reviews.productId, s.reviews.userId], set: fields });

  // Photos/videos taken out of an edited review.
  if (before) {
    const kept = new Set(v.media.flatMap((m) => [m.url, m.poster]));
    await deleteUnreferencedUploads(before.media.flatMap((m) => [m.url, m.poster]).filter((u) => u && !kept.has(u)));
  }

  after(async () => {
    const [p] = await db().select({ name: s.products.name }).from(s.products).where(eq(s.products.id, v.productId));
    const photos = v.media.filter((m) => m.type === "image").length;
    const video = v.media.some((m) => m.type === "video");
    const extras = [photos && `${photos} photo${photos > 1 ? "s" : ""}`, video && "video"].filter(Boolean).join(" + ");
    const snippet = v.body ? ` “${v.body.length > 80 ? v.body.slice(0, 80).trimEnd() + "…" : v.body}”` : "";
    await notifyAdmins({
      type: "review",
      title: `${before ? "Review updated" : "New review"} · ${"★".repeat(v.rating)}${"☆".repeat(5 - v.rating)}`,
      body: `${user.name} on ${p?.name ?? "a product"}${extras ? ` · ${extras}` : ""}${snippet}`,
      href: "/admin/reviews?status=pending",
    });
  });
  updateTag(REVIEWS_TAG); // an edited review leaves the product page until approved again
  revalidatePath("/account", "layout");
  return { ok: true };
}
