import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, max, or, sql, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import type { ShippingAddress } from "@/lib/db/schema";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/orders";

/*
 * Customer accounts and their orders. Nothing here is cached: every query
 * belongs to one signed-in person (storefront) or is an admin view that must
 * be current, and the pages already stream behind <Suspense>.
 */

/* ───────────── Shared shapes ───────────── */

export type OrderListRow = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  total: number;
  createdAt: Date;
  itemCount: number;
  /** First items' photos, for the little stack on the order card. */
  images: string[];
  firstItemName: string | null;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  userId: string | null;
  customerName: string;
  customerPhone: string;
  shippingAddress: ShippingAddress;
  subtotal: number;
  shippingFee: number;
  codFee: number;
  returnFee: number | null;
  discount: number;
  total: number;
  couponCode: string | null;
  couponId: string | null;
  /** Admin only: the coupon's influencer and their commission on this order. */
  influencerId: string | null;
  commission: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  razorpayPaymentId: string | null;
  accessToken: string | null;
  paymentProofUrl: string | null;
  paymentReference: string | null;
  paymentNote: string | null;
  paymentVerifiedAt: Date | null;
  codConsentAt: Date | null;
  notes: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: string;
    productId: string | null;
    name: string;
    variantLabel: string | null;
    imageUrl: string | null;
    unitPrice: number;
    quantity: number;
    slug: string | null;
    /** Bought in an offer bundle: its title and which bundle of the order (1, 2…). */
    offerTitle: string | null;
    bundleNo: number | null;
  }[];
  history: { id: string; status: OrderStatus; note: string | null; createdAt: Date }[];
};

const orderListColumns = {
  id: s.orders.id,
  orderNumber: s.orders.orderNumber,
  status: s.orders.status,
  paymentMethod: s.orders.paymentMethod,
  paymentStatus: s.orders.paymentStatus,
  total: s.orders.total,
  createdAt: s.orders.createdAt,
};

/** Adds item count, first item name and up to 3 photos to order rows. */
async function withItemSummary<T extends { id: string }>(rows: T[]) {
  if (rows.length === 0) return [] as (T & Pick<OrderListRow, "itemCount" | "images" | "firstItemName">)[];
  const items = await db()
    .select({ orderId: s.orderItems.orderId, name: s.orderItems.name, imageUrl: s.orderItems.imageUrl, quantity: s.orderItems.quantity })
    .from(s.orderItems)
    .where(inArray(s.orderItems.orderId, rows.map((r) => r.id)))
    .orderBy(asc(s.orderItems.id));
  return rows.map((r) => {
    const mine = items.filter((i) => i.orderId === r.id);
    return {
      ...r,
      itemCount: mine.reduce((n, i) => n + i.quantity, 0),
      images: mine.flatMap((i) => (i.imageUrl ? [i.imageUrl] : [])).slice(0, 3),
      firstItemName: mine[0]?.name ?? null,
    };
  });
}

export async function loadOrderDetail(where: SQL): Promise<OrderDetail | null> {
  const d = db();
  const [order] = await d.select().from(s.orders).where(where);
  if (!order) return null;
  const [items, history] = await Promise.all([
    d
      .select({
        id: s.orderItems.id,
        productId: s.orderItems.productId,
        name: s.orderItems.name,
        variantLabel: s.orderItems.variantLabel,
        imageUrl: s.orderItems.imageUrl,
        unitPrice: s.orderItems.unitPrice,
        quantity: s.orderItems.quantity,
        offerTitle: s.orderItems.offerTitle,
        bundleNo: s.orderItems.bundleNo,
        // Link back to the product only while it is still live in the store.
        slug: sql<string | null>`case when "products"."status" = 'active' then "products"."slug" end`,
      })
      .from(s.orderItems)
      .leftJoin(s.products, eq(s.products.id, s.orderItems.productId))
      .where(eq(s.orderItems.orderId, order.id))
      // Regular items first, then each offer's items together.
      .orderBy(sql`coalesce(${s.orderItems.bundleNo}, 0)`, asc(s.orderItems.id)),
    d
      .select({ id: s.orderStatusHistory.id, status: s.orderStatusHistory.status, note: s.orderStatusHistory.note, createdAt: s.orderStatusHistory.createdAt })
      .from(s.orderStatusHistory)
      .where(eq(s.orderStatusHistory.orderId, order.id))
      .orderBy(asc(s.orderStatusHistory.createdAt)),
  ]);
  return { ...order, items, history };
}

/* ───────────── Storefront (signed-in customer) ───────────── */

/**
 * The customer's orders, newest first, with their item summary, in ONE query
 * (the DB is far away; every round trip is felt on the account page).
 * Correlated subqueries name their tables explicitly: Drizzle prints bare
 * column names inside sql``.
 */
export async function getMyOrders(userId: string): Promise<OrderListRow[]> {
  return db()
    .select({
      ...orderListColumns,
      itemCount: sql<number>`coalesce((select sum(i."quantity") from "order_items" i where i."order_id" = "orders"."id"), 0)::int`,
      images: sql<string[]>`array(select i."image_url" from "order_items" i where i."order_id" = "orders"."id" and i."image_url" is not null order by i."id" limit 3)`,
      firstItemName: sql<string | null>`(select i."name" from "order_items" i where i."order_id" = "orders"."id" order by i."id" limit 1)`,
    })
    .from(s.orders)
    .where(eq(s.orders.userId, userId))
    .orderBy(desc(s.orders.createdAt))
    .limit(200);
}

/** One of the customer's own orders, by its number. Someone else's order → null. */
export function getMyOrder(userId: string, orderNumber: string) {
  return loadOrderDetail(and(eq(s.orders.userId, userId), eq(s.orders.orderNumber, orderNumber)) as SQL);
}

/* ───────────── Admin ───────────── */

export const CUSTOMER_SORTS = ["newest", "spent", "orders", "recent"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];
export const CUSTOMERS_PER_PAGE = 30;

export type AdminCustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  isBlocked: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  orders: number;
  /** Total of orders that weren't cancelled, in rupees. */
  spent: number;
  lastOrderAt: Date | null;
};

/** Per-customer order stats; cancelled orders don't count as spend. */
function orderStats() {
  return db()
    .select({
      userId: s.orders.userId,
      orders: count().as("orders"),
      spent: sql<number>`coalesce(sum(${s.orders.total}) filter (where ${s.orders.status} <> 'cancelled'), 0)::int`.as("spent"),
      lastOrderAt: max(s.orders.createdAt).as("last_order_at"),
    })
    .from(s.orders)
    .groupBy(s.orders.userId)
    .as("stats");
}

export async function listCustomersForAdmin(opts: { q?: string; sort?: CustomerSort; page?: number; blocked?: boolean }) {
  const d = db();
  const stats = orderStats();
  const conds: SQL[] = [eq(s.users.role, "customer")];
  if (opts.q) {
    const digits = opts.q.replace(/\D/g, "");
    const like = `%${opts.q.replace(/[%_\\]/g, "\\$&")}%`;
    conds.push(or(ilike(s.users.name, like), ...(digits.length >= 3 ? [ilike(s.users.phone, `%${digits.slice(-10)}%`)] : []))!);
  }
  if (opts.blocked) conds.push(eq(s.users.isBlocked, true));
  const where = and(...conds);

  const ordersN = sql<number>`coalesce(${stats.orders}, 0)::int`;
  const spent = sql<number>`coalesce(${stats.spent}, 0)::int`;
  const order =
    opts.sort === "spent"
      ? [desc(spent), desc(s.users.createdAt)]
      : opts.sort === "orders"
        ? [desc(ordersN), desc(s.users.createdAt)]
        : opts.sort === "recent"
          ? [sql`${s.users.lastLoginAt} desc nulls last`, desc(s.users.createdAt)]
          : [desc(s.users.createdAt)];

  const page = Math.max(1, opts.page ?? 1);
  const [rows, [{ total }], [summary]] = await Promise.all([
    d
      .select({
        id: s.users.id,
        name: s.users.name,
        phone: s.users.phone,
        isBlocked: s.users.isBlocked,
        createdAt: s.users.createdAt,
        lastLoginAt: s.users.lastLoginAt,
        orders: ordersN,
        spent,
        lastOrderAt: stats.lastOrderAt,
      })
      .from(s.users)
      .leftJoin(stats, eq(stats.userId, s.users.id))
      .where(where)
      .orderBy(...order)
      .limit(CUSTOMERS_PER_PAGE)
      .offset((page - 1) * CUSTOMERS_PER_PAGE),
    d.select({ total: count() }).from(s.users).where(where),
    d
      .select({
        all: count(),
        blocked: sql<number>`count(*) filter (where ${s.users.isBlocked})::int`,
        newThisMonth: sql<number>`count(*) filter (where ${s.users.createdAt} > now() - interval '30 days')::int`,
        // Correlated subquery: Drizzle prints bare column names here, so name the tables explicitly.
        withOrders: sql<number>`count(*) filter (where exists (select 1 from "orders" o where o."user_id" = "users"."id"))::int`,
      })
      .from(s.users)
      .where(eq(s.users.role, "customer")),
  ]);

  return {
    rows: rows as AdminCustomerRow[],
    total,
    page,
    pages: Math.max(1, Math.ceil(total / CUSTOMERS_PER_PAGE)),
    summary,
  };
}

export type AdminCustomerDetail = {
  id: string;
  name: string;
  phone: string | null;
  isBlocked: boolean;
  adminNote: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  activeSessions: number;
  stats: { orders: number; spent: number; average: number; delivered: number; cancelled: number; open: number };
  orders: OrderListRow[];
  addresses: ShippingAddress[];
  reviews: number;
};

export async function getCustomerForAdmin(id: string): Promise<AdminCustomerDetail | null> {
  const d = db();
  const [user] = await d
    .select({
      id: s.users.id,
      name: s.users.name,
      phone: s.users.phone,
      role: s.users.role,
      isBlocked: s.users.isBlocked,
      adminNote: s.users.adminNote,
      createdAt: s.users.createdAt,
      lastLoginAt: s.users.lastLoginAt,
    })
    .from(s.users)
    .where(eq(s.users.id, id));
  if (!user || user.role !== "customer") return null;

  const [orderRows, [sess], addresses, [rev]] = await Promise.all([
    d.select(orderListColumns).from(s.orders).where(eq(s.orders.userId, id)).orderBy(desc(s.orders.createdAt)).limit(500),
    d.select({ n: count() }).from(s.sessions).where(and(eq(s.sessions.userId, id), sql`${s.sessions.expiresAt} > now()`)),
    d.select().from(s.addresses).where(eq(s.addresses.userId, id)).orderBy(desc(s.addresses.isDefault)),
    d.select({ n: count() }).from(s.reviews).where(eq(s.reviews.userId, id)),
  ]);
  const orders = await withItemSummary(orderRows);

  const sold = orders.filter((o) => o.status !== "cancelled");
  const spent = sold.reduce((n, o) => n + o.total, 0);
  // Addresses saved on the account, plus the ones used on orders (until checkout saves them).
  const seen = new Set<string>();
  const allAddresses: ShippingAddress[] = [];
  const pushAddress = (a: ShippingAddress) => {
    const key = [a.line1, a.city, a.pincode].join("|").toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    allAddresses.push(a);
  };
  addresses.forEach((a) => pushAddress({ ...a, line2: a.line2 ?? undefined, landmark: a.landmark ?? undefined }));
  if (orders.length) {
    const used = await d
      .select({ a: s.orders.shippingAddress })
      .from(s.orders)
      .where(eq(s.orders.userId, id))
      .orderBy(desc(s.orders.createdAt))
      .limit(20);
    used.forEach((u) => pushAddress(u.a));
  }

  return {
    ...user,
    activeSessions: sess.n,
    stats: {
      orders: orders.length,
      spent,
      average: sold.length ? Math.round(spent / sold.length) : 0,
      delivered: orders.filter((o) => o.status === "delivered").length,
      cancelled: orders.filter((o) => o.status === "cancelled").length,
      open: orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length,
    },
    orders,
    addresses: allAddresses,
    reviews: rev.n,
  };
}

export async function getOrderForAdmin(id: string) {
  const order = await loadOrderDetail(eq(s.orders.id, id));
  if (!order?.influencerId) return order && { ...order, influencerName: null as string | null };
  const [inf] = await db().select({ name: s.influencers.name }).from(s.influencers).where(eq(s.influencers.id, order.influencerId));
  return { ...order, influencerName: inf?.name ?? null };
}
