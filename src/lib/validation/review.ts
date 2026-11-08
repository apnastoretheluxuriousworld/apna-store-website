/**
 * Review media rules, shared by the admin media picker, testimonials and
 * (later) the customer review form.
 */
import { z } from "zod";

const VIDEO_EXT = /\.(mp4|webm|mov)(\?|#|$)/i;

/** Best guess from a pasted URL (uploads always set the type themselves). */
export const mediaTypeFromUrl = (url: string): "image" | "video" => (VIDEO_EXT.test(url) ? "video" : "image");

const mediaUrl = z
  .string()
  .trim()
  .min(1, "URL is required")
  .max(500)
  .refine((v) => v.startsWith("/") || /^https:\/\//.test(v), "Must be an https:// URL");

export const reviewMediaSchema = z.object({
  type: z.enum(["image", "video"]),
  url: mediaUrl,
  poster: mediaUrl.nullish().transform((v) => v ?? null),
});

export const REVIEW_STATUSES = ["pending", "published"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/* ───────────── Customer reviews (storefront) ───────────── */

export const CUSTOMER_REVIEW_LIMITS = { photos: 3, videos: 1, body: 2000 } as const;

/** Orders in these states unlock "Write a review" for their products. */
export const REVIEWABLE_ORDER_STATUSES = ["shipped", "delivered"] as const;

export const customerReviewSchema = z.object({
  productId: z.uuid(),
  rating: z.number().int().min(1, "Please choose a star rating").max(5),
  body: z
    .string()
    .trim()
    .max(CUSTOMER_REVIEW_LIMITS.body, `At most ${CUSTOMER_REVIEW_LIMITS.body} characters`)
    .transform((v) => v || null),
  media: z
    .array(reviewMediaSchema)
    .refine((m) => m.filter((x) => x.type === "image").length <= CUSTOMER_REVIEW_LIMITS.photos, `Up to ${CUSTOMER_REVIEW_LIMITS.photos} photos`)
    .refine((m) => m.filter((x) => x.type === "video").length <= CUSTOMER_REVIEW_LIMITS.videos, "Only one video"),
});
export type CustomerReviewInput = z.input<typeof customerReviewSchema>;
