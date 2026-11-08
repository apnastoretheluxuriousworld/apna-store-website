/**
 * Coupons and influencers: rules shared by the admin forms, checkout and the
 * server (client-safe). Money is whole rupees.
 */
import { z } from "zod";
import { formatPrice } from "@/lib/format";
import { normalizePhone } from "./customer";

/* ───────────── Codes ───────────── */

export const CODE_MIN = 3;
export const CODE_MAX = 20;

/** What the customer typed → how codes are stored (upper-case, no spaces). */
export const normalizeCode = (raw: string) =>
  raw.replace(/\s+/g, "").toUpperCase();

export const codeSchema = z
  .string()
  .transform(normalizeCode)
  .pipe(
    z
      .string()
      .min(CODE_MIN, `At least ${CODE_MIN} characters`)
      .max(CODE_MAX, `At most ${CODE_MAX} characters`)
      .regex(/^[A-Z0-9-]+$/, "Letters, numbers and - only"),
  );

/** A random, easy-to-read code (no 0/O/1/I), optionally after a prefix like RIYA. */
export function generateCode(prefix = "") {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const p = normalizeCode(prefix)
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  const n = p ? 4 : 8;
  const rnd = Array.from(
    crypto.getRandomValues(new Uint32Array(n)),
    (x) => abc[x % abc.length],
  ).join("");
  return p + rnd;
}

/* ───────────── Discount maths ───────────── */

export type CouponRule = {
  type: "percent" | "flat";
  value: number;
  maxDiscount: number | null;
  minOrder: number;
};

/** Rupees off a bag of `subtotal` (never more than the bag itself). 0 below the minimum order. */
export function couponDiscount(rule: CouponRule, subtotal: number) {
  if (subtotal <= 0 || subtotal < rule.minOrder) return 0;
  let off =
    rule.type === "percent"
      ? Math.floor((subtotal * rule.value) / 100)
      : rule.value;
  if (rule.type === "percent" && rule.maxDiscount != null)
    off = Math.min(off, rule.maxDiscount);
  return Math.max(0, Math.min(off, subtotal));
}

/** "10% off · up to ₹3,000" / "₹1,500 off" (+ minimum order). */
export function describeCoupon(rule: CouponRule, withMin = true) {
  const head =
    rule.type === "percent"
      ? `${rule.value}% off${rule.maxDiscount != null ? ` · up to ${formatPrice(rule.maxDiscount)}` : ""}`
      : `${formatPrice(rule.value)} off`;
  return withMin && rule.minOrder > 0
    ? `${head} · on orders of ${formatPrice(rule.minOrder)}+`
    : head;
}

/** Commission on one order: % of what the customer paid for the items (after the discount, before shipping). */
export const commissionFor = (
  subtotal: number,
  discount: number,
  percent: number,
) => (percent > 0 ? Math.round(((subtotal - discount) * percent) / 100) : 0);

/* ───────────── Admin status ───────────── */

export type CouponStatus =
  "active" | "scheduled" | "expired" | "used_up" | "off";

export const COUPON_STATUS_LABEL: Record<CouponStatus, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  used_up: "Used up",
  off: "Off",
};

/* ───────────── Dates (the store runs on India time) ───────────── */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** "2026-11-30" → that day's first moment in India. */
export const istDayStart = (d: string) => new Date(`${d}T00:00:00+05:30`);
/** "2026-11-30" → that day's last moment in India (a coupon "valid till the 30th" works all of the 30th). */
export const istDayEnd = (d: string) => new Date(`${d}T23:59:59.999+05:30`);
/** Date → "2026-11-30" in India time (for date inputs). */
export const toIstDay = (date: Date | string | null) =>
  date
    ? new Date(new Date(date).getTime() + 5.5 * 3600_000)
        .toISOString()
        .slice(0, 10)
    : "";

const istShort = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});
export const formatIstDay = (date: Date | string) =>
  istShort.format(new Date(date));

/* ───────────── Admin: coupon form ───────────── */

/** "" / null → null, else a whole number in range. */
const optionalInt = (min: number, max: number, msg: string) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce
      .number<number>()
      .int("Whole numbers only")
      .min(min, msg)
      .max(max, `At most ${max.toLocaleString("en-IN")}`)
      .nullable(),
  );
const day = z
  .string()
  .trim()
  .refine((v) => v === "" || DAY.test(v), "Pick a date");

const couponFields = z.object({
  code: codeSchema,
  type: z.enum(["percent", "flat"]),
  value: z.coerce
    .number<number>()
    .int("Whole numbers only")
    .min(1, "Enter the discount"),
  maxDiscount: optionalInt(1, 10_00_000, "At least ₹1"),
  minOrder: z.coerce
    .number<number>()
    .int("Whole rupees only")
    .min(0, "Can't be negative")
    .max(10_00_000)
    .default(0),
  maxUses: optionalInt(1, 1_000_000, "At least 1"),
  perCustomerLimit: optionalInt(1, 1000, "At least 1"),
  firstOrderOnly: z.boolean().default(false),
  influencerId: z.union([z.literal(""), z.uuid()]).default(""),
  note: z.string().trim().max(300, "At most 300 characters").default(""),
  startsOn: day.default(""),
  endsOn: day.default(""),
  isActive: z.boolean().default(true),
});

type CouponFields = z.output<typeof couponFields>;
function couponRules(v: CouponFields, ctx: z.RefinementCtx) {
  if (v.type === "percent" && v.value > 100)
    ctx.addIssue({ code: "custom", path: ["value"], message: "At most 100%" });
  if (v.type === "flat" && v.value > 10_00_000)
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: "That's too large",
    });
  if (v.type === "flat" && v.minOrder > 0 && v.value >= v.minOrder) {
    ctx.addIssue({
      code: "custom",
      path: ["minOrder"],
      message: "Keep the minimum order above the discount",
    });
  }
  if (v.startsOn && v.endsOn && v.endsOn < v.startsOn)
    ctx.addIssue({
      code: "custom",
      path: ["endsOn"],
      message: "Ends before it starts",
    });
}

/** The admin form (the id is added on save). */
export const couponFormSchema = couponFields.superRefine(couponRules);
/** What the server action accepts. */
export const couponInputSchema = couponFields
  .extend({ id: z.uuid() })
  .superRefine(couponRules);
export type CouponInput = z.input<typeof couponInputSchema>;
export type CouponOutput = z.output<typeof couponInputSchema>;

/* ───────────── Admin: influencer form ───────────── */

export const influencerInputSchema = z.object({
  id: z.uuid(),
  name: z
    .string()
    .trim()
    .min(2, "Enter their name")
    .max(60, "At most 60 characters"),
  handle: z
    .string()
    .trim()
    .transform((v) =>
      v
        .replace(/^@+/, "")
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
        .replace(/\/+$/, ""),
    )
    .pipe(
      z
        .string()
        .max(40, "At most 40 characters")
        .refine(
          (v) => v === "" || /^[\w.]+$/.test(v),
          "Just the handle, e.g. riya.styles",
        ),
    )
    .default(""),
  phone: z
    .string()
    .trim()
    .default("")
    .transform((v, ctx) => {
      if (!v) return "";
      const p = normalizePhone(v);
      if (!p) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a valid 10-digit mobile number",
        });
        return z.NEVER;
      }
      return p;
    }),
  commissionPercent: z.coerce
    .number<number>()
    .int("Whole numbers only")
    .min(0, "Can't be negative")
    .max(50, "At most 50%")
    .default(0),
  notes: z.string().trim().max(500, "At most 500 characters").default(""),
  isActive: z.boolean().default(true),
});
export type InfluencerInput = z.input<typeof influencerInputSchema>;
export type InfluencerOutput = z.output<typeof influencerInputSchema>;

/* ───────────── Checkout ───────────── */

export const applyCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter a coupon code")
    .max(40)
    .transform(normalizeCode),
  /** The mobile number typed so far (to check "once per customer"); may be empty. */
  phone: z.string().trim().max(20).default(""),
});
