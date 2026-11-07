/**
 * "Our Feed" (homepage vertical videos, 9:16) — shared by the admin and the Server Actions.
 */
import { z } from "zod";

export const FEED_LIMITS = { caption: 150 } as const;

const mediaUrl = z
  .string()
  .trim()
  .min(1, "Upload a video")
  .max(500)
  .refine((v) => v.startsWith("/") || /^https:\/\//.test(v), "Must be an https:// URL");

export const feedVideoInputSchema = z.object({
  /** Client-generated for creates (idempotent outbox retries). */
  id: z.uuid(),
  caption: z.string().trim().max(FEED_LIMITS.caption, `At most ${FEED_LIMITS.caption} characters`).optional().default(""),
  videoUrl: mediaUrl,
  posterUrl: mediaUrl.nullish().transform((v) => v ?? null),
  isActive: z.boolean(),
});

export type FeedVideoInput = z.input<typeof feedVideoInputSchema>;
