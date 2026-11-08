import "server-only";
import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { loadOrderDetail } from "./customers";

/** An order by its private link (the page guests and customers get after checkout). */
export function getOrderByToken(token: string) {
  return loadOrderDetail(eq(s.orders.accessToken, token));
}

/* ───────────── Admin list ───────────── */

export const ORDER_TABS = ["verify", "new", "active", "delivered", "cancelled", "all"] as const;
export type OrderTab = (typeof ORDER_TABS)[number];
export const ORDERS_PER_PAGE = 30;

const notCancelled = sql`${s.orders.status} <> 'cancelled'`;

/** UPI orders whose screenshot hasn't been checked yet. */
const toVerify = and(eq(s.orders.paymentMethod, "upi"), eq(s.orders.paymentStatus, "pending"), notCancelled)!;

const tabWhere: Record<OrderTab, SQL | undefined> = {
  verify: toVerify,
  new: eq(s.orders.status, "placed"),
  active: inArray(s.orders.status, ["confirmed", "packed", "shipped"]),
  delivered: eq(s.orders.status, "delivered"),
  cancelled: eq(s.orders.status, "cancelled"),
  all: undefined,
};

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  userId: string | null;
  status: (typeof s.orderStatus.enumValues)[number];
  paymentMethod: (typeof s.paymentMethod.enumValues)[number];
  paymentStatus: (typeof s.paymentStatus.enumValues)[number];
  total: number;
  createdAt: Date;
  city: string;
  itemCount: number;
  images: string[];
  firstItemName: string | null;
  hasProof: boolean;
};

export async function listOrdersForAdmin(opts: { tab: OrderTab; q?: string; page?: number }) {
  const d = db();
  const conds: SQL[] = [];
  const t = tabWhere[opts.tab];
  if (t) conds.push(t);
  if (opts.q) {
    const q = opts.q.trim();
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    const digits = q.replace(/\D/g, "");
    conds.push(
      or(
        ilike(s.orders.orderNumber, like),
        ilike(s.orders.customerName, like),
        ...(digits.length >= 3 ? [ilike(s.orders.customerPhone, `%${digits.slice(-10)}%`), ilike(s.orders.paymentReference, `%${digits}%`)] : []),
      )!,
    );
  }
  const where = conds.length ? and(...conds) : undefined;
  const page = Math.max(1, opts.page ?? 1);

  const [rows, [{ total }], [counts]] = await Promise.all([
    d
      .select({
        id: s.orders.id,
        orderNumber: s.orders.orderNumber,
        customerName: s.orders.customerName,
        customerPhone: s.orders.customerPhone,
        userId: s.orders.userId,
        status: s.orders.status,
        paymentMethod: s.orders.paymentMethod,
        paymentStatus: s.orders.paymentStatus,
        total: s.orders.total,
        createdAt: s.orders.createdAt,
        city: sql<string>`${s.orders.shippingAddress}->>'city'`,
        hasProof: sql<boolean>`${s.orders.paymentProofUrl} is not null`,
        // Correlated subqueries name their tables explicitly (Drizzle prints bare columns in sql``).
        itemCount: sql<number>`coalesce((select sum(i."quantity") from "order_items" i where i."order_id" = "orders"."id"), 0)::int`,
        images: sql<string[]>`array(select i."image_url" from "order_items" i where i."order_id" = "orders"."id" and i."image_url" is not null order by i."id" limit 3)`,
        firstItemName: sql<string | null>`(select i."name" from "order_items" i where i."order_id" = "orders"."id" order by i."id" limit 1)`,
      })
      .from(s.orders)
      .where(where)
      .orderBy(desc(s.orders.createdAt))
      .limit(ORDERS_PER_PAGE)
      .offset((page - 1) * ORDERS_PER_PAGE),
    d.select({ total: count() }).from(s.orders).where(where),
    d
      .select({
        verify: sql<number>`count(*) filter (where ${toVerify})::int`,
        new: sql<number>`count(*) filter (where ${tabWhere.new})::int`,
        active: sql<number>`count(*) filter (where ${tabWhere.active})::int`,
      })
      .from(s.orders),
  ]);

  return {
    rows: rows as AdminOrderRow[],
    total,
    page,
    pages: Math.max(1, Math.ceil(total / ORDERS_PER_PAGE)),
    counts: counts as Record<"verify" | "new" | "active", number>,
  };
}
