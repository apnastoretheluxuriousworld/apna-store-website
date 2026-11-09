"use server";

import { randomBytes, randomInt } from "node:crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { clientIp } from "@/lib/auth/request";
import { db, schema as s } from "@/lib/db";
import {
  adjustStock,
  getCheckoutSettings,
  priceBag,
  priceCart,
  readCheckoutSettingsNow,
  type BundleLine,
  type CartLine,
} from "@/lib/data/checkout";
import { checkCoupon } from "@/lib/data/coupons";
import { PRODUCTS_TAG } from "@/lib/data/products";
import { addNotification, announceToAdmins, notifyAdmins, type NewNotification } from "@/lib/data/notifications";
import { formatPrice } from "@/lib/format";
import { allowHit } from "@/lib/rate-limit";
import { keyFromUrl, storage, UploadRejected, uploadKinds } from "@/lib/storage";
import { deleteUnreferencedUploads } from "@/lib/storage/cleanup";
import { zodFieldErrors, type ActionResult } from "@/lib/actions";
import {
  cartSchema,
  codBlockReason,
  computeTotals,
  placeOrderSchema,
  proofSchema,
  type CheckoutSettings,
} from "@/lib/validation/checkout";
import { applyCouponSchema, commissionFor, describeCoupon, type CouponRule } from "@/lib/validation/coupon";
import { normalizePhone } from "@/lib/validation/customer";
import { bundlesSchema } from "@/lib/validation/offer";

const DB_DOWN = "We couldn't reach the store right now. Please try again in a moment.";
const HOUR = 60 * 60 * 1000;

/*
 * Abuse limits. Orders take stock out the moment they're placed (before COD is
 * paid or a UPI screenshot is checked), so fake orders could make real
 * products show "Sold out". These caps keep that to a few orders per number
 * and per network until the store confirms or cancels them.
 */
const ORDERS_PER_NETWORK_PER_HOUR = 10;
const MAX_UNCONFIRMED_PER_PHONE = 3;
const PROOF_UPLOADS_PER_NETWORK_PER_HOUR = 10;

async function ipKey(prefix: string) {
  return `${prefix}:${(await clientIp()) ?? "unknown"}`;
}

/* ───────────── Bag ───────────── */

export type PublicBundle = Omit<BundleLine, "picks"> & { picks: Omit<BundleLine["picks"][number], "trackStock">[] };
export type CartQuote = { lines: Omit<CartLine, "trackStock">[]; bundles: PublicBundle[]; settings: CheckoutSettings };

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- drops the internal field
const publicLine = ({ trackStock, ...line }: CartLine) => line;
const publicBundle = (b: BundleLine): PublicBundle => ({
  ...b,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- drops the internal field
  picks: b.picks.map(({ trackStock, ...p }) => p),
});

/** Live names, photos, prices and stock for the bag in this browser (products and offer bundles). */
export async function quoteCart(items: unknown, bundles: unknown = []): Promise<ActionResult<CartQuote>> {
  const parsed = cartSchema.safeParse(items);
  const parsedBundles = bundlesSchema.safeParse(bundles);
  if (!parsed.success || !parsedBundles.success) return { ok: false, error: "Your cart couldn't be read. Please refresh the page." };
  try {
    const [bag, settings] = await Promise.all([priceBag(parsed.data, parsedBundles.data), getCheckoutSettings()]);
    return { ok: true, data: { lines: bag.lines.map(publicLine), bundles: bag.bundles.map(publicBundle), settings } };
  } catch (e) {
    console.error("[quoteCart]", e);
    return { ok: false, error: DB_DOWN };
  }
}

/* ───────────── Coupon ───────────── */

export type AppliedCoupon = { code: string; rule: CouponRule; discount: number; label: string };

/**
 * Checks a coupon code against the bag (and the mobile number typed so far, for
 * "once per customer"). Only a preview: placeOrder checks it again.
 */
export async function applyCoupon(input: unknown, items: unknown): Promise<ActionResult<AppliedCoupon>> {
  const parsed = applyCouponSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const cart = cartSchema.safeParse(items);
  if (!cart.success) return { ok: false, error: "Your cart couldn't be read. Please refresh the page." };
  // Stops guessing codes by trying thousands of them.
  if (!(await allowHit(await ipKey("coupon"), 40, HOUR))) {
    return { ok: false, error: "Too many tries. Please wait a while and try again." };
  }
  try {
    const user = await getCurrentUser();
    const lines = await priceCart(cart.data);
    // Coupons work on the regular items only: offer bundles already have their own price.
    const subtotal = lines.filter((l) => !l.issue).reduce((n, l) => n + l.unitPrice * l.quantity, 0);
    if (subtotal <= 0) return { ok: false, error: "Coupons don't apply to offers. Add other items to your cart to use a code." };
    const res = await checkCoupon(parsed.data.code, {
      subtotal,
      phone: normalizePhone(parsed.data.phone) ?? (user?.role === "customer" ? user.phone : null),
      userId: user?.role === "customer" ? user.id : null,
    });
    if (!res.ok) return res;
    const { code, rule } = res.coupon;
    return { ok: true, data: { code, rule, discount: res.discount, label: describeCoupon(rule, false) } };
  } catch (e) {
    console.error("[applyCoupon]", e);
    return { ok: false, error: DB_DOWN };
  }
}

/* ───────────── Payment screenshot upload ───────────── */

const uploadSchema = z.object({
  contentType: z.enum(Object.keys(uploadKinds.image.types) as [string, ...string[]]),
  size: z.number().int().positive(),
});

/** Presigned upload for a payment screenshot (images only, straight to the bucket). */
export async function getProofUploadUrl(input: unknown): Promise<ActionResult<{ uploadUrl: string; publicUrl: string }>> {
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please upload a photo or screenshot (JPG, PNG or WebP)." };
  if (!(await allowHit(await ipKey("proof"), PROOF_UPLOADS_PER_NETWORK_PER_HOUR, HOUR))) {
    return { ok: false, error: "Too many uploads from this network. Please try again in a while." };
  }
  try {
    const res = await storage.createUploadUrl({ folder: "payments", ...parsed.data });
    return { ok: true, data: { uploadUrl: res.uploadUrl, publicUrl: res.publicUrl } };
  } catch (e) {
    if (e instanceof UploadRejected) return { ok: false, error: e.message };
    console.error("[getProofUploadUrl]", e);
    return { ok: false, error: "Couldn't prepare the upload. Please try again." };
  }
}

/** Only screenshots uploaded through getProofUploadUrl are accepted. */
const isOurProof = (url: string) => keyFromUrl(url)?.startsWith("payments/") ?? false;

/* ───────────── Place order ───────────── */

export type PlaceOrderResult =
  | { ok: true; token: string; orderNumber: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      /** The bag changed on the server (price, stock): show these lines. */
      lines?: CartQuote["lines"];
      bundles?: CartQuote["bundles"];
      /** The coupon can't be used any more (expired, used up…): the checkout drops it. */
      couponRejected?: boolean;
    };

async function newOrderNumber(tx: Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0]) {
  for (let i = 0; i < 8; i++) {
    const n = `AS-${randomInt(100000, 1000000)}`;
    const [taken] = await tx.select({ id: s.orders.id }).from(s.orders).where(eq(s.orders.orderNumber, n));
    if (!taken) return n;
  }
  return `AS-${Date.now().toString().slice(-8)}`;
}

class CartChanged extends Error {
  constructor(
    public lines: CartLine[],
    public bundles: BundleLine[],
  ) {
    super("cart changed");
  }
}

export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the highlighted details.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  const v = parsed.data;
  if (v.paymentMethod === "upi" && !isOurProof(v.proofUrl)) {
    return { ok: false, error: "Please upload your payment screenshot again.", fieldErrors: { proofUrl: "Upload the payment screenshot" } };
  }
  if (!(await allowHit(await ipKey("order"), ORDERS_PER_NETWORK_PER_HOUR, HOUR))) {
    return { ok: false, error: "Too many orders from this network in the last hour. Please call or WhatsApp the store." };
  }

  const user = await getCurrentUser();
  const d = db();
  try {
    // Orders the store hasn't confirmed yet, for this number (or this signed-in account).
    const [{ waiting }] = await d
      .select({ waiting: sql<number>`count(*)::int` })
      .from(s.orders)
      .where(
        and(
          eq(s.orders.status, "placed"),
          user?.role === "customer"
            ? or(eq(s.orders.customerPhone, v.address.phone), eq(s.orders.userId, user.id))
            : eq(s.orders.customerPhone, v.address.phone),
        ),
      );
    if (waiting >= MAX_UNCONFIRMED_PER_PHONE) {
      return {
        ok: false,
        error: `You already have ${waiting} orders waiting for the store to confirm them. Please call or WhatsApp the store to place another.`,
      };
    }

    const settings = await readCheckoutSettingsNow();
    if (v.paymentMethod === "upi" && !settings.upiEnabled) {
      return { ok: false, error: "UPI payment isn't available right now. Please choose another way to pay." };
    }

    const pending: { notification?: NewNotification } = {}; // announced once the order is committed
    const result = await d.transaction(async (tx) => {
      const { lines, bundles } = await priceBag(v.items, v.bundles, { tx, lock: true });
      if (lines.some((l) => l.issue) || bundles.some((b) => b.issue)) throw new CartChanged(lines, bundles);

      // Coupons only ever apply to the regular items (offers have their own price).
      const itemsSubtotal = lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
      const subtotal = itemsSubtotal + bundles.reduce((n, b) => n + b.price, 0);

      // Re-check the coupon with its row locked, so its limits hold under concurrent orders.
      if (v.couponCode && itemsSubtotal <= 0) {
        return { error: `Coupon ${v.couponCode}: coupons don't apply to offers`, couponRejected: true } as const;
      }
      const coupon = v.couponCode
        ? await checkCoupon(
            v.couponCode,
            { subtotal: itemsSubtotal, phone: v.address.phone, userId: user?.role === "customer" ? user.id : null },
            { tx, lock: true },
          )
        : null;
      if (coupon && !coupon.ok) return { error: `Coupon ${v.couponCode}: ${coupon.error}`, couponRejected: true } as const;
      const applied = coupon?.ok ? coupon : null;

      const totals = computeTotals(subtotal, settings, v.paymentMethod, applied?.discount ?? 0);
      if (v.paymentMethod === "cod") {
        const blocked = codBlockReason(totals.total - totals.codFee, settings);
        if (blocked) return { error: blocked } as const;
      }

      const bundleItems = bundles.flatMap((b, i) =>
        b.picks.map((p) => ({ ...p, offerId: b.offerId, offerTitle: b.title, bundleNo: i + 1 })),
      );
      await adjustStock(tx, [...lines, ...bundleItems.map((p) => ({ ...p, quantity: 1 }))], -1);

      const a = v.address;
      const orderNumber = await newOrderNumber(tx);
      const token = randomBytes(18).toString("base64url");
      const now = new Date();
      const [order] = await tx
        .insert(s.orders)
        .values({
          orderNumber,
          accessToken: token,
          userId: user?.role === "customer" ? user.id : null,
          customerName: a.fullName,
          customerPhone: a.phone,
          shippingAddress: {
            fullName: a.fullName,
            phone: a.phone,
            line1: a.line1,
            ...(a.line2 ? { line2: a.line2 } : {}),
            ...(a.landmark ? { landmark: a.landmark } : {}),
            city: a.city,
            state: a.state,
            pincode: a.pincode,
          },
          ...totals,
          ...(applied
            ? {
                couponCode: applied.coupon.code,
                couponId: applied.coupon.id,
                influencerId: applied.coupon.influencerId,
                commission: applied.coupon.influencerId
                  ? commissionFor(itemsSubtotal, totals.discount, applied.coupon.commissionPercent)
                  : 0,
              }
            : {}),
          returnFee: settings.returnFee || null,
          paymentMethod: v.paymentMethod,
          paymentStatus: "pending",
          status: "placed",
          notes: v.notes || null,
          ...(v.paymentMethod === "upi"
            ? { paymentProofUrl: v.proofUrl, paymentReference: v.reference || null }
            : { codConsentAt: now }),
        })
        .returning({ id: s.orders.id });

      await tx.insert(s.orderItems).values([
        ...lines.map((l) => ({
          orderId: order.id,
          productId: l.productId,
          variantId: l.variantId,
          name: l.name,
          variantLabel: l.variantLabel,
          imageUrl: l.image,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
        })),
        ...bundleItems.map((p) => ({
          orderId: order.id,
          productId: p.productId,
          variantId: p.variantId,
          name: p.name,
          variantLabel: p.variantLabel,
          imageUrl: p.image,
          unitPrice: p.price,
          quantity: 1,
          offerId: p.offerId,
          offerTitle: p.offerTitle,
          bundleNo: p.bundleNo,
        })),
      ]);
      await tx.insert(s.orderStatusHistory).values({
        orderId: order.id,
        status: "placed",
        note: v.paymentMethod === "upi" ? "Payment screenshot received. We'll verify it shortly." : "Cash on delivery.",
      });
      const itemCount = lines.reduce((n, l) => n + l.quantity, 0) + bundleItems.length;
      const notification: NewNotification = {
        type: "order",
        title: `New order #${orderNumber} · ${formatPrice(totals.total)}`,
        body: `${a.fullName}, ${a.city} · ${itemCount} item${itemCount > 1 ? "s" : ""} · ${
          v.paymentMethod === "upi" ? "UPI: payment to verify" : "Cash on delivery"
        }${bundles.length ? ` · ${bundles.length === 1 ? `offer: ${bundles[0].title}` : `${bundles.length} offers`}` : ""}${
          applied ? ` · coupon ${applied.coupon.code}` : ""
        }`,
        href: `/admin/orders/${order.id}`,
      };
      await addNotification(notification, tx);
      pending.notification = notification;

      // Signed-in customers: remember the address for next time.
      if (user?.role === "customer" && v.saveAddress) {
        const existing = await tx
          .select({ id: s.addresses.id, line1: s.addresses.line1, pincode: s.addresses.pincode })
          .from(s.addresses)
          .where(eq(s.addresses.userId, user.id));
        const same = existing.find((e) => e.line1.toLowerCase() === a.line1.toLowerCase() && e.pincode === a.pincode);
        if (same) {
          await tx.update(s.addresses).set({ isDefault: false }).where(eq(s.addresses.userId, user.id));
          await tx
            .update(s.addresses)
            .set({ ...a, line2: a.line2 || null, landmark: a.landmark || null, isDefault: true })
            .where(eq(s.addresses.id, same.id));
        } else if (existing.length < 10) {
          await tx.update(s.addresses).set({ isDefault: false }).where(eq(s.addresses.userId, user.id));
          await tx.insert(s.addresses).values({ ...a, line2: a.line2 || null, landmark: a.landmark || null, userId: user.id, isDefault: true });
        }
      }
      return { token, orderNumber } as const;
    });

    if ("error" in result) {
      return {
        ok: false,
        error: result.error!,
        ...("couponRejected" in result ? { couponRejected: true, fieldErrors: { couponCode: result.error! } } : {}),
      };
    }
    // Live admin notification + phone push, after the response is sent.
    const { notification } = pending;
    if (notification) after(() => announceToAdmins(notification).catch((e) => console.error("[checkout] announce", e)));
    updateTag(PRODUCTS_TAG); // stock changed → "Sold out" on cards
    if (user) revalidatePath("/account", "layout");
    return { ok: true, token: result.token, orderNumber: result.orderNumber };
  } catch (e) {
    if (e instanceof CartChanged) {
      return {
        ok: false,
        error: "Some items in your cart changed (price or stock). Please review your cart.",
        lines: e.lines.map(publicLine),
        bundles: e.bundles.map(publicBundle),
      };
    }
    console.error("[placeOrder]", e);
    return { ok: false, error: DB_DOWN };
  }
}

/* ───────────── Order page (by its private link) ───────────── */

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,40}$/);

/** After the store rejects a screenshot: the customer sends a new one. */
export async function resubmitPaymentProof(token: string, input: unknown): Promise<ActionResult> {
  if (!tokenSchema.safeParse(token).success) return { ok: false, error: "Order not found." };
  const parsed = proofSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please upload the payment screenshot.", fieldErrors: zodFieldErrors(parsed.error) };
  if (!isOurProof(parsed.data.proofUrl)) return { ok: false, error: "Please upload the screenshot again." };

  const d = db();
  const [order] = await d
    .select({
      id: s.orders.id,
      userId: s.orders.userId,
      old: s.orders.paymentProofUrl,
      orderNumber: s.orders.orderNumber,
      customerName: s.orders.customerName,
      total: s.orders.total,
    })
    .from(s.orders)
    .where(
      and(
        eq(s.orders.accessToken, token),
        eq(s.orders.paymentMethod, "upi"),
        inArray(s.orders.paymentStatus, ["pending", "failed"]),
        sql`${s.orders.status} <> 'cancelled'`,
      ),
    );
  if (!order) return { ok: false, error: "This order can't take a new screenshot. Please contact the store." };

  await d
    .update(s.orders)
    .set({ paymentProofUrl: parsed.data.proofUrl, paymentReference: parsed.data.reference || null, paymentStatus: "pending", paymentNote: null })
    .where(eq(s.orders.id, order.id));
  if (order.old && order.old !== parsed.data.proofUrl) void deleteUnreferencedUploads([order.old]);
  after(() =>
    notifyAdmins({
      type: "payment",
      title: `New payment screenshot · #${order.orderNumber}`,
      body: `${order.customerName} · ${formatPrice(order.total)} · please verify`,
      href: `/admin/orders/${order.id}`,
    }),
  );
  if (order.userId) revalidatePath("/account", "layout");
  revalidatePath(`/order/${token}`);
  return { ok: true };
}
