/**
 * Cart + checkout rules, shared by the browser and the server (client-safe).
 * Money is whole rupees.
 */
import { z } from "zod";
import { nameSchema, phoneSchema } from "./customer";

/* ───────────── Cart ───────────── */

export const MAX_QTY_PER_LINE = 10;
export const MAX_CART_LINES = 30;

export const cartItemSchema = z.object({
  productId: z.uuid(),
  variantId: z.uuid().nullable(),
  qty: z.number().int().min(1).max(MAX_QTY_PER_LINE),
});
export type CartItem = z.infer<typeof cartItemSchema>;

export const cartSchema = z.array(cartItemSchema).min(1, "Your cart is empty").max(MAX_CART_LINES);

export const lineKey = (i: { productId: string; variantId: string | null }) => `${i.productId}:${i.variantId ?? ""}`;

/* ───────────── Payment & delivery settings (Admin → Settings) ───────────── */

const rupees = (max: number) => z.coerce.number<number>().int("Whole rupees only").min(0, "Can't be negative").max(max);

export const paymentSettingsSchema = z.object({
  /** The store's UPI QR image (uploaded in admin). UPI checkout is offered only when it's set. */
  qrUrl: z.union([z.literal(""), z.url("Upload the QR image")]).default(""),
  /** Optional: lets customers copy the UPI ID or open their UPI app with the amount filled in. */
  upiId: z
    .string()
    .trim()
    .max(100)
    .default("")
    .refine((v) => !v || /^[\w.-]{2,256}@[a-zA-Z][\w.-]{1,63}$/.test(v), "Looks like name@bank, e.g. apnastore@okaxis"),
  payeeName: z.string().trim().max(60).default(""),
  codEnabled: z.boolean().default(true),
  /** COD only for orders of at least this much (0 = any amount). */
  codMinOrder: rupees(10_00_000).default(500),
  /** Extra charge added to the total when the customer pays cash on delivery (0 = none). */
  codFee: rupees(10_000).default(0),
  /** Charge if the customer returns the order; shown at checkout, not added to the total (0 = not shown). */
  returnFee: rupees(1_00_000).default(0),
  shippingFee: rupees(10_000).default(0),
  /** Free shipping at or above this subtotal (0 = never free when a fee is set). */
  freeShippingAbove: rupees(10_00_000).default(0),
});
export type PaymentSettingsInput = z.input<typeof paymentSettingsSchema>;
export type PaymentSettings = z.output<typeof paymentSettingsSchema>;

/** What the storefront needs at checkout (no admin-only bits). */
export type CheckoutSettings = PaymentSettings & { upiEnabled: boolean };

export function toCheckoutSettings(p: PaymentSettings): CheckoutSettings {
  return { ...p, upiEnabled: !!p.qrUrl };
}

/**
 * Order totals. The COD charge applies only once cash on delivery is chosen.
 * A coupon `discount` comes off the items; free shipping is judged on what the
 * customer pays for them (after the discount).
 */
export function computeTotals(
  subtotal: number,
  s: Pick<PaymentSettings, "shippingFee" | "freeShippingAbove" | "codFee">,
  method: "upi" | "cod" | null = null,
  discount = 0,
) {
  discount = Math.max(0, Math.min(discount, subtotal));
  const items = subtotal - discount;
  const free = s.shippingFee <= 0 || (s.freeShippingAbove > 0 && items >= s.freeShippingAbove);
  const shippingFee = subtotal > 0 && !free ? s.shippingFee : 0;
  const codFee = method === "cod" && subtotal > 0 ? s.codFee : 0;
  return { subtotal, discount, shippingFee, codFee, total: items + shippingFee + codFee };
}

/** null = COD allowed, else the reason it isn't. `total` = bag + shipping (before the COD charge). */
export function codBlockReason(total: number, s: Pick<PaymentSettings, "codEnabled" | "codMinOrder">) {
  if (!s.codEnabled) return "Cash on delivery isn't available right now.";
  if (total < s.codMinOrder) return `Cash on delivery is available on orders of ₹${s.codMinOrder.toLocaleString("en-IN")} or more.`;
  return null;
}

/** upi://pay link that opens the customer's UPI app with the amount filled in. */
export function upiPayLink(s: Pick<PaymentSettings, "upiId" | "payeeName">, amount: number, note = "Apna Store order") {
  const q = new URLSearchParams({ pa: s.upiId, pn: s.payeeName || "Apna Store", am: amount.toFixed(2), cu: "INR", tn: note });
  return `upi://pay?${q.toString()}`;
}

/* ───────────── Address ───────────── */

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

const line = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max, `At most ${max} characters`);
const optionalLine = (max: number) => z.string().trim().max(max, `At most ${max} characters`).optional().default("");

export const addressSchema = z.object({
  fullName: nameSchema,
  phone: phoneSchema,
  line1: line(3, 120, "Enter your house / flat and street"),
  line2: optionalLine(120),
  landmark: optionalLine(80),
  city: line(2, 60, "Enter your city or town"),
  state: z.enum(INDIAN_STATES, "Choose your state"),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),
});
export type AddressInput = z.input<typeof addressSchema>;

/* ───────────── Place order ───────────── */

/** UPI transaction id / UTR: 12 digits on most apps; some show letters too. Optional. */
export const utrSchema = z
  .string()
  .trim()
  .max(40)
  .optional()
  .default("")
  .refine((v) => !v || /^[A-Za-z0-9-]{6,40}$/.test(v), "Enter the transaction ID exactly as shown in your UPI app");

/** The applied coupon code, if any ("" = none). The server re-checks it when the order is placed. */
const couponField = z
  .string()
  .trim()
  .max(40)
  .optional()
  .default("")
  .transform((v) => v.replace(/\s+/g, "").toUpperCase());

export const placeOrderSchema = z.discriminatedUnion("paymentMethod", [
  z.object({
    paymentMethod: z.literal("upi"),
    items: cartSchema,
    address: addressSchema,
    notes: optionalLine(300),
    saveAddress: z.boolean().default(true),
    couponCode: couponField,
    proofUrl: z.url("Upload the payment screenshot"),
    reference: utrSchema,
  }),
  z.object({
    paymentMethod: z.literal("cod"),
    items: cartSchema,
    address: addressSchema,
    notes: optionalLine(300),
    saveAddress: z.boolean().default(true),
    couponCode: couponField,
    codConsent: z.literal(true, "Please confirm you'll pay cash on delivery"),
  }),
]);
export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

export const proofSchema = z.object({ proofUrl: z.url("Upload the payment screenshot"), reference: utrSchema });
