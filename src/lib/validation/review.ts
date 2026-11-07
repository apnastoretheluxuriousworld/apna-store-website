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
