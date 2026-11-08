import "server-only";
import { and, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db, schema as s, type Database } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { couponDiscount, formatIstDay, toIstDay, type CouponRule, type CouponStatus } from "@/lib/validation/coupon";
import type { OrderStatus } from "@/lib/orders";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const notCancelled = ne(s.orders.status, "cancelled");

/* ───────────── Checking a code at checkout ───────────── */

export type CheckedCoupon = {
  id: string;
  code: string;
  rule: CouponRule;
  influencerId: string | null;
  commissionPercent: number;
};

export type CouponCheck = { ok: true; coupon: CheckedCoupon; discount: number } | { ok: false; error: string };

const INVALID = "This code isn't valid. Please check the spelling.";

/**
 * Is `code` usable on a bag of `subtotal` by this customer (mobile number and/or
 * signed-in account)? Every rule the admin set is checked here, on the server.
 * With `lock` (inside the order transaction) the coupon row is locked, so two
 * customers can't both take the last use.
 */
export async function checkCoupon(
  code: string,
  who: { subtotal: number; phone?: string | null; userId?: string | null },
  opts: { tx?: Tx; lock?: boolean } = {},
): Promise<CouponCheck> {
  const d = opts.tx ?? db();
  const q = d
    .select({
      id: s.coupons.id,
      code: s.coupons.code,
      type: s.coupons.type,
      value: s.coupons.value,
      maxDiscount: s.coupons.maxDiscount,
      minOrder: s.coupons.minOrder,
      maxUses: s.coupons.maxUses,
      perCustomerLimit: s.coupons.perCustomerLimit,
      firstOrderOnly: s.coupons.firstOrderOnly,
      isActive: s.coupons.isActive,
      startsAt: s.coupons.startsAt,
      expiresAt: s.coupons.expiresAt,
      started: sql<boolean>`(${s.coupons.startsAt} is null or ${s.coupons.startsAt} <= now())`,
      expired: sql<boolean>`(${s.coupons.expiresAt} is not null and ${s.coupons.expiresAt} < now())`,
      influencerId: s.coupons.influencerId,
      influencerActive: s.influencers.isActive,
      commissionPercent: s.influencers.commissionPercent,
    })
    .from(s.coupons)
    .leftJoin(s.influencers, eq(s.influencers.id, s.coupons.influencerId))
    .where(eq(s.coupons.code, code));
  const [c] = opts.lock ? await q.for("update", { of: s.coupons }) : await q;

  // An influencer who's been switched off takes their codes with them.
  if (!c || !c.isActive || c.influencerActive === false) return { ok: false, error: INVALID };
  if (!c.started) return { ok: false, error: `This code starts on ${formatIstDay(c.startsAt!)}.` };
  if (c.expired) return { ok: false, error: `This code expired on ${formatIstDay(c.expiresAt!)}.` };
  if (who.subtotal < c.minOrder) {
    return {
      ok: false,
      error: `Add ${formatPrice(c.minOrder - who.subtotal)} more to use this code (minimum order ${formatPrice(c.minOrder)}).`,
    };
  }

  const count = async (where: SQL | undefined) => {
    const [r] = await d.select({ n: sql<number>`count(*)::int` }).from(s.orders).where(where);
    return r?.n ?? 0;
  };

  if (c.maxUses != null && (await count(and(eq(s.orders.couponId, c.id), notCancelled))) >= c.maxUses) {
    return { ok: false, error: "This code has been fully used." };
  }

  // The same customer = the same mobile number (guests too) or the same account.
  const mine = or(
    who.phone ? eq(s.orders.customerPhone, who.phone) : undefined,
    who.userId ? eq(s.orders.userId, who.userId) : undefined,
  );
  if (mine) {
    if (c.perCustomerLimit != null && (await count(and(eq(s.orders.couponId, c.id), notCancelled, mine))) >= c.perCustomerLimit) {
      return { ok: false, error: c.perCustomerLimit === 1 ? "You've already used this code." : "You've used this code the maximum number of times." };
    }
    if (c.firstOrderOnly && (await count(and(notCancelled, mine))) > 0) {
      return { ok: false, error: "This code is for your first order only." };
    }
  }

  const rule: CouponRule = { type: c.type, value: c.value, maxDiscount: c.maxDiscount, minOrder: c.minOrder };
  const discount = couponDiscount(rule, who.subtotal);
  if (discount <= 0) return { ok: false, error: INVALID };
  return {
    ok: true,
    discount,
    coupon: { id: c.id, code: c.code, rule, influencerId: c.influencerId, commissionPercent: c.commissionPercent ?? 0 },
  };
}

/* ───────────── Admin (private-cached; call after requireAdminView()) ───────────── */

type OrderStats = { orders: number; sales: number; discount: number };
const emptyStats: OrderStats = { orders: 0, sales: 0, discount: 0 };

/** Orders (not cancelled), what customers paid for the items, and the discount given — per coupon. */
async function statsByCoupon(ids: string[]) {
  if (!ids.length) return new Map<string, OrderStats>();
  const rows = await db()
    .select({
      id: s.orders.couponId,
      orders: sql<number>`count(*)::int`,
      sales: sql<number>`coalesce(sum(${s.orders.subtotal} - ${s.orders.discount}), 0)::int`,
      discount: sql<number>`coalesce(sum(${s.orders.discount}), 0)::int`,
    })
    .from(s.orders)
    .where(and(inArray(s.orders.couponId, ids), notCancelled))
    .groupBy(s.orders.couponId);
  return new Map(rows.map((r) => [r.id!, { orders: r.orders, sales: r.sales, discount: r.discount }]));
}

async function couponRows(where?: SQL) {
  const rows = await db()
    .select({
      c: s.coupons,
      influencerName: s.influencers.name,
      influencerActive: s.influencers.isActive,
      started: sql<boolean>`(${s.coupons.startsAt} is null or ${s.coupons.startsAt} <= now())`,
      expired: sql<boolean>`(${s.coupons.expiresAt} is not null and ${s.coupons.expiresAt} < now())`,
    })
    .from(s.coupons)
    .leftJoin(s.influencers, eq(s.influencers.id, s.coupons.influencerId))
    .where(where)
    .orderBy(desc(s.coupons.createdAt));
  const stats = await statsByCoupon(rows.map((r) => r.c.id));

  return rows.map(({ c, influencerName, influencerActive, started, expired }) => {
    const st = stats.get(c.id) ?? emptyStats;
    const status: CouponStatus =
      !c.isActive || influencerActive === false
        ? "off"
        : expired
          ? "expired"
          : !started
            ? "scheduled"
            : c.maxUses != null && st.orders >= c.maxUses
              ? "used_up"
              : "active";
    return {
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value,
      maxDiscount: c.maxDiscount,
      minOrder: c.minOrder,
      maxUses: c.maxUses,
      perCustomerLimit: c.perCustomerLimit,
      firstOrderOnly: c.firstOrderOnly,
      influencerId: c.influencerId,
      influencerName,
      /** The influencer is switched off (their codes don't work). */
      influencerOff: influencerActive === false,
      note: c.note ?? "",
      startsOn: toIstDay(c.startsAt),
      endsOn: toIstDay(c.expiresAt),
      isActive: c.isActive,
      status,
      uses: st.orders,
      sales: st.sales,
      discountGiven: st.discount,
    };
  });
}

export type AdminCouponRow = Awaited<ReturnType<typeof couponRows>>[number];

export async function listCouponsForAdmin() {
  "use cache: private";
  cacheLife("admin");
  return couponRows();
}

export async function getCouponForEdit(id: string): Promise<AdminCouponRow | null> {
  "use cache: private";
  cacheLife("admin");
  const [row] = await couponRows(eq(s.coupons.id, id));
  return row ?? null;
}

/** Every code in use, so the form can warn about a duplicate before saving. */
export async function listCouponCodes() {
  "use cache: private";
  cacheLife("admin");
  const rows = await db().select({ id: s.coupons.id, code: s.coupons.code }).from(s.coupons);
  return rows;
}

/* ───────────── Influencers ───────────── */

export type InfluencerOption = { id: string; name: string; handle: string | null; isActive: boolean; commissionPercent: number };

export async function listInfluencerOptions(): Promise<InfluencerOption[]> {
  "use cache: private";
  cacheLife("admin");
  return db()
    .select({
      id: s.influencers.id,
      name: s.influencers.name,
      handle: s.influencers.handle,
      isActive: s.influencers.isActive,
      commissionPercent: s.influencers.commissionPercent,
    })
    .from(s.influencers)
    .orderBy(s.influencers.name);
}

type InfluencerStats = OrderStats & {
  /** Commission on delivered orders (owed / paid). */
  earned: number;
  /** Commission on orders not delivered yet (becomes earned on delivery; dropped if cancelled). */
  pending: number;
};

async function statsByInfluencer(ids: string[]) {
  if (!ids.length) return new Map<string, InfluencerStats>();
  const rows = await db()
    .select({
      id: s.orders.influencerId,
      orders: sql<number>`count(*)::int`,
      sales: sql<number>`coalesce(sum(${s.orders.subtotal} - ${s.orders.discount}), 0)::int`,
      discount: sql<number>`coalesce(sum(${s.orders.discount}), 0)::int`,
      earned: sql<number>`coalesce(sum(${s.orders.commission}) filter (where ${s.orders.status} = 'delivered'), 0)::int`,
      pending: sql<number>`coalesce(sum(${s.orders.commission}) filter (where ${s.orders.status} <> 'delivered'), 0)::int`,
    })
    .from(s.orders)
    .where(and(inArray(s.orders.influencerId, ids), notCancelled))
    .groupBy(s.orders.influencerId);
  return new Map(rows.map((r) => [r.id!, { orders: r.orders, sales: r.sales, discount: r.discount, earned: r.earned, pending: r.pending }]));
}

const emptyInfluencerStats: InfluencerStats = { ...emptyStats, earned: 0, pending: 0 };

async function influencerRows(where?: SQL) {
  const rows = await db()
    .select({
      i: s.influencers,
      codes: sql<string[]>`coalesce((select array_agg(c."code" order by c."created_at" desc) from "coupons" c where c."influencer_id" = ${s.influencers.id}), '{}')`,
    })
    .from(s.influencers)
    .where(where)
    .orderBy(desc(s.influencers.isActive), s.influencers.name);
  const stats = await statsByInfluencer(rows.map((r) => r.i.id));
  return rows.map(({ i, codes }) => ({
    id: i.id,
    name: i.name,
    handle: i.handle ?? "",
    phone: i.phone ?? "",
    commissionPercent: i.commissionPercent,
    notes: i.notes ?? "",
    isActive: i.isActive,
    codes,
    ...(stats.get(i.id) ?? emptyInfluencerStats),
  }));
}

export type AdminInfluencerRow = Awaited<ReturnType<typeof influencerRows>>[number];

export async function listInfluencersForAdmin() {
  "use cache: private";
  cacheLife("admin");
  return influencerRows();
}

export type InfluencerOrderRow = {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
  couponCode: string | null;
  itemsPaid: number;
  commission: number;
  status: OrderStatus;
};

/** One influencer with their coupons and latest orders. */
export async function getInfluencerForEdit(id: string) {
  "use cache: private";
  cacheLife("admin");
  const [row] = await influencerRows(eq(s.influencers.id, id));
  if (!row) return null;
  const [coupons, recent] = await Promise.all([
    couponRows(eq(s.coupons.influencerId, id)),
    db()
      .select({
        id: s.orders.id,
        orderNumber: s.orders.orderNumber,
        createdAt: s.orders.createdAt,
        customerName: s.orders.customerName,
        couponCode: s.orders.couponCode,
        subtotal: s.orders.subtotal,
        discount: s.orders.discount,
        commission: s.orders.commission,
        status: s.orders.status,
      })
      .from(s.orders)
      .where(eq(s.orders.influencerId, id))
      .orderBy(desc(s.orders.createdAt))
      .limit(50),
  ]);
  return {
    ...row,
    coupons,
    recentOrders: recent.map(
      (o): InfluencerOrderRow => ({
        id: o.id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt.toISOString(),
        customerName: o.customerName,
        couponCode: o.couponCode,
        itemsPaid: o.subtotal - o.discount,
        commission: o.commission,
        status: o.status,
      }),
    ),
  };
}
