/**
 * Homepage testimonial validation — shared by the admin form and the Server Actions.
 */
import { z } from "zod";
import { reviewMediaSchema } from "./review";

export const TESTIMONIAL_LIMITS = { body: 600, name: 60, city: 60 } as const;

export const testimonialInputSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1, "Name is required").max(TESTIMONIAL_LIMITS.name),
    city: z.string().trim().max(TESTIMONIAL_LIMITS.city).optional().default(""),
    rating: z.number({ error: "Choose a rating" }).int().min(1, "Choose a rating").max(5),
    body: z.string().trim().max(TESTIMONIAL_LIMITS.body, `At most ${TESTIMONIAL_LIMITS.body} characters`).optional().default(""),
    /** One photo or video (0–1 items; an array so the shared media picker can be used). */
    media: z.array(reviewMediaSchema).max(1, "One photo or video per testimonial").default([]),
    isActive: z.boolean(),
  })
  .refine((t) => t.body || t.media.length, { message: "Add the client's words, a photo or a video", path: ["body"] });

export type TestimonialOutput = z.output<typeof testimonialInputSchema>;
