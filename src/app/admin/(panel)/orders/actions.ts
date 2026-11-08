"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema as s } from "@/lib/db";
import type { ActionResult } from "@/lib/actions";
import { ORDER_STATUSES } from "@/lib/orders";
import { adjustStock } from "@/lib/data/checkout";
import { PRODUCTS_TAG } from "@/lib/data/products";

const idSchema = z.uuid();

const statusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
});

/**
 * Moves an order to a new status and records it in the order's history (the
 * customer's tracker reads that history). A cash-on-delivery order marked
 * Delivered is also marked Paid. Cancelling puts the items back in stock
 * (and un-cancelling takes them out again).
 */
export async function setOrderStatus(id: string, input: { status: string; note?: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid order." };
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a valid status." };
  const { status, note } = parsed.data;

  const ok = await db().transaction(async (tx) => {
    const [order] = await tx
      .select({ status: s.orders.status, paymentMethod: s.orders.paymentMethod, paymentStatus: s.orders.paymentStatus })
      .from(s.orders)
      .where(eq(s.orders.id, id))
      .for("update");
    if (!order) return false;
    if (order.status === status && !note) return true; // nothing to record
    const codPaid = status === "delivered" && order.paymentMethod === "cod" && order.paymentStatus === "pending";
    await tx
      .update(s.orders)
      .set({ status, ...(codPaid ? { paymentStatus: "paid" as const } : {}) })
      .where(eq(s.orders.id, id));
    await tx.insert(s.orderStatusHistory).values({ orderId: id, status, note: note || null, changedBy: admin.id });
    const cancelling = status === "cancelled" && order.status !== "cancelled";
    const reopening = order.status === "cancelled" && status !== "cancelled";
    if (cancelling || reopening) {
      const items = await tx
        .select({ productId: s.orderItems.productId, variantId: s.orderItems.variantId, quantity: s.orderItems.quantity })
        .from(s.orderItems)
        .where(eq(s.orderItems.orderId, id));
      await adjustStock(tx, items, cancelling ? 1 : -1);
      return "stock" as const;
    }
    return true;
  });
  if (!ok) return { ok: false, error: "Order not found." };
  if (ok === "stock") updateTag(PRODUCTS_TAG);
  revalidatePath("/admin", "layout");
  revalidatePath("/account", "layout");
  return { ok: true };
}

const reviewSchema = z.discriminatedUnion("approve", [
  z.object({ approve: z.literal(true) }),
  z.object({ approve: z.literal(false), reason: z.string().trim().min(3, "Tell the customer what's wrong").max(300) }),
]);

/**
 * UPI orders: the store checks the customer's screenshot against its bank/UPI app.
 * Approve → Paid, and a new order moves to Confirmed.
 * Reject → the customer sees the reason on their order page and can upload a new screenshot.
 */
export async function reviewPayment(id: string, input: { approve: true } | { approve: false; reason: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid order." };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const res = await db().transaction(async (tx) => {
    const [order] = await tx
      .select({ status: s.orders.status, paymentMethod: s.orders.paymentMethod })
      .from(s.orders)
      .where(eq(s.orders.id, id))
      .for("update");
    if (!order) return "Order not found.";
    if (order.paymentMethod !== "upi") return "Only UPI payments are verified here.";
    if (v.approve) {
      await tx
        .update(s.orders)
        .set({ paymentStatus: "paid", paymentVerifiedAt: new Date(), paymentNote: null, ...(order.status === "placed" ? { status: "confirmed" as const } : {}) })
        .where(eq(s.orders.id, id));
      if (order.status === "placed") {
        await tx.insert(s.orderStatusHistory).values({ orderId: id, status: "confirmed", note: "Payment received. Thank you!", changedBy: admin.id });
      }
    } else {
      await tx.update(s.orders).set({ paymentStatus: "failed", paymentVerifiedAt: null, paymentNote: v.reason }).where(eq(s.orders.id, id));
    }
    return null;
  });
  if (res) return { ok: false, error: res };
  revalidatePath("/admin", "layout");
  revalidatePath("/account", "layout");
  return { ok: true };
}

const trackingSchema = z.object({
  courierName: z.string().trim().max(80),
  trackingNumber: z.string().trim().max(80),
  trackingUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), "Enter a full link starting with https://"),
});

export async function saveOrderTracking(
  id: string,
  input: { courierName: string; trackingNumber: string; trackingUrl: string },
): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid order." };
  const parsed = trackingSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue.message, fieldErrors: { [String(issue.path[0])]: issue.message } };
  }
  const v = parsed.data;
  const [row] = await db()
    .update(s.orders)
    .set({ courierName: v.courierName || null, trackingNumber: v.trackingNumber || null, trackingUrl: v.trackingUrl || null })
    .where(eq(s.orders.id, id))
    .returning({ id: s.orders.id });
  if (!row) return { ok: false, error: "Order not found." };
  revalidatePath("/admin", "layout");
  return { ok: true };
}
