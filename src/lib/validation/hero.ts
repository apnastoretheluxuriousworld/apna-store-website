/**
 * Homepage hero banners — shared by the admin form and the Server Actions.
 */
import { z } from "zod";

export const HERO_LIMITS = {
  eyebrow: 40,
  title: 60,
  highlight: 40,
  subtitle: 200,
  ctaLabel: 30,
} as const;

const isLink = (v: string) => v.startsWith("/") || /^https:\/\//.test(v);
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters`)
    .optional()
    .default("");

const fields = {
  imageUrl: z
    .string()
    .trim()
    .min(1, "Upload an image")
    .max(500)
    .refine(isLink, "Must be an https:// URL"),
  eyebrow: text(HERO_LIMITS.eyebrow),
  title: text(HERO_LIMITS.title),
  highlight: text(HERO_LIMITS.highlight),
  subtitle: text(HERO_LIMITS.subtitle),
  ctaLabel: text(HERO_LIMITS.ctaLabel),
  /** "" = no button. */
  ctaHref: z
    .string()
    .trim()
    .max(500)
    .optional()
    .default("")
    .refine(
      (v) => !v || isLink(v),
      "Use a page path like /shop/watches or a full https:// link",
    ),
  isActive: z.boolean(),
};

const hasHeadline = (t: { title: string; highlight: string }) => !!(t.title || t.highlight);
const headlineError = { message: "Add a headline", path: ["title"] };

/** The admin form (the id is added on save). */
export const heroSlideFormSchema = z.object(fields).refine(hasHeadline, headlineError);

export const heroSlideInputSchema = z
  .object({
    /** Client-generated for creates (idempotent outbox retries). */
    id: z.uuid(),
    ...fields,
  })
  .refine(hasHeadline, headlineError);

export type HeroSlideInput = z.input<typeof heroSlideInputSchema>;
