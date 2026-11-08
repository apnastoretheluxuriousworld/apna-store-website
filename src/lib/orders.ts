/**
 * Order status vocabulary shared by the storefront and the admin (client-safe).
 * Happy path: placed → confirmed → packed → shipped → delivered.
 * "cancelled" can happen at any step before delivery.
 */

export const ORDER_STATUSES = ["placed", "confirmed", "packed", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_FLOW = ["placed", "confirmed", "packed", "shipped", "delivered"] as const satisfies readonly OrderStatus[];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Order placed",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** What the customer reads under each step of the tracker. */
export const STATUS_HINT: Record<OrderStatus, string> = {
  placed: "We've received your order.",
  confirmed: "Your order is confirmed and being prepared.",
  packed: "Packed with care and ready to ship.",
  shipped: "On its way to you.",
  delivered: "Delivered. Enjoy your purchase.",
  cancelled: "This order was cancelled.",
};

/** Badge colours (Tailwind classes) per status. */
export const STATUS_TONE: Record<OrderStatus, string> = {
  placed: "border-gold-500/40 text-gold-300",
  confirmed: "border-gold-500/40 text-gold-300",
  packed: "border-sky-400/40 text-sky-300",
  shipped: "border-sky-400/40 text-sky-300",
  delivered: "border-emerald-400/40 text-emerald-300",
  cancelled: "border-red-400/40 text-red-300",
};

export type PaymentMethod = "razorpay" | "cod" | "upi";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export const PAYMENT_LABEL: Record<PaymentMethod, string> = { razorpay: "Paid online", cod: "Cash on delivery", upi: "UPI" };
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = { pending: "Pending", paid: "Paid", failed: "Failed", refunded: "Refunded" };

/** Payment status in the customer's words (a UPI "pending" means we're still checking the screenshot). */
export function paymentStatusText(method: PaymentMethod, status: PaymentStatus) {
  if (method === "upi" && status === "pending") return "Verifying your payment";
  if (method === "upi" && status === "failed") return "Payment not verified";
  if (method === "cod" && status === "pending") return "Pay in cash when it arrives";
  return PAYMENT_STATUS_LABEL[status];
}

/** Statuses that count as a real sale in totals (not cancelled). */
export const isOpenOrSold = (status: OrderStatus) => status !== "cancelled";

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});
const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export const formatDateTime = (d: Date | string) => dateTime.format(new Date(d));
export const formatDate = (d: Date | string) => date.format(new Date(d));

/** "3 min ago", "5 days ago", or a date for anything older than a month. */
export function timeAgo(d: Date | string | null | undefined, now = Date.now()) {
  if (!d) return "Never";
  const s = Math.max(0, Math.round((now - new Date(d).getTime()) / 1000));
  if (s < 60) return "Just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? "s" : ""} ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  return formatDate(d);
}
