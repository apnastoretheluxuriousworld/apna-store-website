/**
 * Combo offers ("Any 3 for ₹1,000"): rules shared by the admin form, the
 * offer page, the bag and the server (client-safe). Money is whole rupees.
 */
import { z } from "zod";
import { formatPrice } from "@/lib/format";

export const OFFER_LIMITS = {
  title: 60,
  description: 400,
  /** Products the admin can put in one offer. */
  products: 60,
  /** Items a customer picks for one offer. */
  pickCount: 10,
  price: 10_00_000,
} as const;

/** Offer bundles one bag can hold. */
export const MAX_BUNDLES = 10;

/* ───────────── Bag ───────────── */

export const bundlePickSchema = z.object({ productId: z.uuid(), variantId: z.uuid().nullable() });
export type BundlePickInput = z.infer<typeof bundlePickSchema>;

/** One offer in the bag: the items the customer chose for it. `id` tells two bundles of the same offer apart. */
export const bundleSchema = z.object({
  id: z.uuid(),
  offerId: z.uuid(),
  picks: z.array(bundlePickSchema).min(1).max(OFFER_LIMITS.pickCount),
});
export type CartBundle = z.infer<typeof bundleSchema>;

export const bundlesSchema = z.array(bundleSchema).max(MAX_BUNDLES);

/**
 * Splits the offer price over its items in proportion to their normal prices
 * (whole rupees that add up exactly). Each order line then carries what the
 * customer really paid for it, which is what a partial refund goes by.
 */
export function allocateBundle(price: number, listPrices: number[]): number[] {
  const n = listPrices.length;
  if (!n) return [];
  const total = listPrices.reduce((a, b) => a + b, 0);
  const exact = listPrices.map((p) => (total > 0 ? (price * p) / total : price / n));
  const out = exact.map(Math.floor);
  let left = price - out.reduce((a, b) => a + b, 0);
  // Largest remainders get the leftover rupees.
  const order = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out;
}

/** "Any 3 for ₹1,000" (or "These 3 for ₹1,000" when the customer gets all of them). */
export function describeOffer(o: { pickCount: number; price: number; productCount?: number }) {
  const fixed = o.productCount != null && o.productCount === o.pickCount;
  return `${fixed ? (o.pickCount === 1 ? "This one" : `These ${o.pickCount}`) : `Any ${o.pickCount}`} for ${formatPrice(o.price)}`;
}

/* ───────────── Admin status ───────────── */

export type OfferStatus = "active" | "scheduled" | "expired" | "off";

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  active: "Live",
  scheduled: "Scheduled",
  expired: "Ended",
  off: "Off",
};

/** `today` = "YYYY-MM-DD" in India. */
export function offerStatus(o: { isActive: boolean; startsOn: string; endsOn: string }, today: string): OfferStatus {
  if (!o.isActive) return "off";
  if (o.endsOn && o.endsOn < today) return "expired";
  if (o.startsOn && o.startsOn > today) return "scheduled";
  return "active";
}

/* ───────────── Admin form ───────────── */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = z
  .string()
  .trim()
  .refine((v) => v === "" || DAY.test(v), "Pick a date");

const isLink = (v: string) => v.startsWith("/") || /^https:\/\//.test(v);

const offerFields = z.object({
  coverUrl: z.string().trim().min(1, "Upload a cover image").max(500).refine(isLink, "Must be an https:// URL"),
  title: z.string().trim().min(2, "Add a title, e.g. Any 3 for ₹1,000").max(OFFER_LIMITS.title, `At most ${OFFER_LIMITS.title} characters`),
  description: z
    .string()
    .trim()
    .max(OFFER_LIMITS.description, `At most ${OFFER_LIMITS.description} characters`)
    .default(""),
  pickCount: z.coerce
    .number<number>()
    .int("Whole numbers only")
    .min(1, "At least 1")
    .max(OFFER_LIMITS.pickCount, `At most ${OFFER_LIMITS.pickCount}`),
  price: z.coerce
    .number<number>()
    .int("Whole rupees only")
    .min(1, "Enter the offer price")
    .max(OFFER_LIMITS.price, "That's too large"),
  productIds: z
    .array(z.uuid())
    .min(1, "Choose the products in this offer")
    .max(OFFER_LIMITS.products, `At most ${OFFER_LIMITS.products} products`)
    .refine((ids) => new Set(ids).size === ids.length, "A product is listed twice"),
  startsOn: day.default(""),
  endsOn: day.default(""),
  isActive: z.boolean().default(true),
});

function offerRules(v: z.output<typeof offerFields>, ctx: z.RefinementCtx) {
  if (v.startsOn && v.endsOn && v.endsOn < v.startsOn) {
    ctx.addIssue({ code: "custom", path: ["endsOn"], message: "Ends before it starts" });
  }
}

/** The admin form (the id is added on save). */
export const offerFormSchema = offerFields.superRefine(offerRules);
/** What the server action accepts. */
export const offerInputSchema = offerFields.extend({ id: z.uuid() }).superRefine(offerRules);
export type OfferInput = z.input<typeof offerInputSchema>;
