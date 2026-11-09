import "server-only";
import { sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db, schema as s } from "@/lib/db";

/*
 * Dashboard charts: orders, revenue, visitors and new customers over time, and
 * sales by collection. Everything is counted by the India date (Asia/Kolkata).
 * All four ranges are worked out in one go, so switching the filter is instant.
 */

export type RangeKey = "week" | "month" | "year" | "all";

export type Bucket = {
  /** Short axis label: "Mon", "12", "Jan", "2027". */
  label: string;
  /** Full name for the tooltip: "Mon, 9 Nov 2026", "Nov 2026", "2027". */
  title: string;
  orders: number;
  revenue: number;
  visitors: number;
  customers: number;
};

export type CollectionSlice = { name: string; value: number; colorIndex: number };

export type RangeData = {
  /** The calendar period shown: "9 – 15 Nov 2026", "November 2026", "2026", "Since Nov 2026". */
  period: string;
  /** How the bars are grouped ("day" | "month" | "year"). */
  unit: "day" | "month" | "year";
  buckets: Bucket[];
  totals: { orders: number; revenue: number; visitors: number; customers: number };
  collections: CollectionSlice[];
};

export type DashboardCharts = Record<RangeKey, RangeData>;

const TZ = "Asia/Kolkata";
// The zone is written into the SQL (not a parameter) so SELECT and GROUP BY match exactly.
const istDay = (col: unknown) => sql<string>`to_char((${col} at time zone ${sql.raw(`'${TZ}'`)})::date, 'YYYY-MM-DD')`;

/* ───────────── Date helpers (all on "YYYY-MM-DD" strings, read as UTC) ───────────── */

const toDate = (key: string) => new Date(`${key}T00:00:00Z`);
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (key: string, n: number) => {
  const d = toDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return dayKey(d);
};
const addMonths = (month: string, n: number) => {
  const d = toDate(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return dayKey(d).slice(0, 7);
};
const fmt = (key: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...opts }).format(toDate(key.length === 7 ? `${key}-01` : key));

function todayIST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()); // YYYY-MM-DD
}

/* ───────────── Query ───────────── */

export async function getDashboardCharts(): Promise<DashboardCharts> {
  "use cache: private";
  cacheLife("admin");
  const d = db();
  const today = todayIST();
  // Fixed calendar periods (not rolling): this week Mon–Sun, this month 1st–last, this year Jan–Dec.
  const weekStart = addDays(today, -((toDate(today).getUTCDay() + 6) % 7));
  const thisMonth = today.slice(0, 7);
  const thisYear = today.slice(0, 4);
  const daysInMonth = new Date(Date.UTC(Number(thisYear), Number(today.slice(5, 7)), 0)).getUTCDate();
  const from = { week: weekStart, month: `${thisMonth}-01`, year: `${thisYear}-01-01` };

  const ordersDay = istDay(s.orders.createdAt);
  const usersDay = istDay(s.users.createdAt);

  const [orderRows, customerRows, visitRows, visitTotals, salesRows, cats] = await Promise.all([
    d
      .select({
        day: ordersDay,
        orders: sql<number>`(count(*) filter (where ${s.orders.status} <> 'cancelled'))::int`,
        revenue: sql<number>`(coalesce(sum(${s.orders.total}) filter (where ${s.orders.paymentStatus} = 'paid'), 0))::int`,
      })
      .from(s.orders)
      .groupBy(ordersDay),
    d
      .select({ day: usersDay, n: sql<number>`count(*)::int` })
      .from(s.users)
      .where(sql`${s.users.role} = 'customer'`)
      .groupBy(usersDay),
    // Distinct visitors per day, per month and per year (a returning visitor counts once per bar).
    d.execute<{ unit: string; k: string; n: number }>(sql`
      select 'day' as unit, to_char(day, 'YYYY-MM-DD') as k, count(*)::int as n from site_visits group by day
      union all
      select 'month', to_char(day, 'YYYY-MM'), count(distinct visitor_id)::int from site_visits group by 2
      union all
      select 'year', to_char(day, 'YYYY'), count(distinct visitor_id)::int from site_visits group by 2
    `),
    d.execute<{ week: number; month: number; year: number; all: number; first: string | null }>(sql`
      select
        (count(distinct visitor_id) filter (where day >= ${from.week}::date))::int as week,
        (count(distinct visitor_id) filter (where day >= ${from.month}::date))::int as month,
        (count(distinct visitor_id) filter (where day >= ${from.year}::date))::int as year,
        count(distinct visitor_id)::int as all,
        to_char(min(day), 'YYYY-MM-DD') as first
      from site_visits
    `),
    // What each collection sold per day (orders not cancelled; offer items carry their share of the offer price).
    d.execute<{ day: string; category_id: string | null; value: number }>(sql`
      select ${ordersDay} as day, p.category_id, sum(oi.unit_price * oi.quantity)::int as value
      from ${s.orderItems} oi
      join ${s.orders} on ${s.orders.id} = oi.order_id
      left join ${s.products} p on p.id = oi.product_id
      where ${s.orders.status} <> 'cancelled'
      group by 1, 2
    `),
    d.select({ id: s.categories.id, name: s.categories.name }).from(s.categories).orderBy(s.categories.sortOrder, s.categories.name),
  ]);

  const orderMap = new Map(orderRows.map((r) => [r.day, r]));
  const customerMap = new Map(customerRows.map((r) => [r.day, r.n]));
  const visits = { day: new Map<string, number>(), month: new Map<string, number>(), year: new Map<string, number>() };
  for (const r of visitRows.rows) visits[r.unit as keyof typeof visits].set(r.k, r.n);
  const vt = visitTotals.rows[0];
  const sales = salesRows.rows;

  /** Sum the daily series over [start, end] keys of a given prefix length (10 = day, 7 = month, 4 = year). */
  function sumOver(prefix: string, len: number) {
    let orders = 0;
    let revenue = 0;
    let customers = 0;
    for (const [k, r] of orderMap) {
      if (k.slice(0, len) !== prefix) continue;
      orders += r.orders;
      revenue += r.revenue;
    }
    for (const [k, n] of customerMap) if (k.slice(0, len) === prefix) customers += n;
    return { orders, revenue, customers };
  }

  function dayBuckets(start: string, days: number, label: Intl.DateTimeFormatOptions): Bucket[] {
    return Array.from({ length: days }, (_, i) => {
      const k = addDays(start, i);
      const o = orderMap.get(k);
      return {
        label: fmt(k, label),
        title: fmt(k, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
        orders: o?.orders ?? 0,
        revenue: o?.revenue ?? 0,
        visitors: visits.day.get(k) ?? 0,
        customers: customerMap.get(k) ?? 0,
      };
    });
  }

  function monthBuckets(startMonth: string, months: number): Bucket[] {
    return Array.from({ length: months }, (_, i) => {
      const m = addMonths(startMonth, i);
      return {
        label: fmt(m, { month: "short" }),
        title: fmt(m, { month: "long", year: "numeric" }),
        ...sumOver(m, 7),
        visitors: visits.month.get(m) ?? 0,
      };
    });
  }

  function yearBuckets(startYear: number, endYear: number): Bucket[] {
    return Array.from({ length: endYear - startYear + 1 }, (_, i) => {
      const y = String(startYear + i);
      return { label: y, title: y, ...sumOver(y, 4), visitors: visits.year.get(y) ?? 0 };
    });
  }

  /** Category colours follow the admin's collection order, so a collection keeps its colour in every range. */
  const catIndex = new Map(cats.map((c, i) => [c.id, i]));
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  function collections(start: string | null): CollectionSlice[] {
    const byCat = new Map<string, number>();
    for (const r of sales) {
      if (start && r.day < start) continue;
      const key = r.category_id && catName.has(r.category_id) ? r.category_id : "other";
      byCat.set(key, (byCat.get(key) ?? 0) + Number(r.value));
    }
    return [...byCat]
      .filter(([, v]) => v > 0)
      .map(([id, value]) => ({
        name: id === "other" ? "Other (removed products)" : catName.get(id)!,
        value,
        // Slots 0–7 are the palette; anything past it (and "Other") is grey.
        colorIndex: id === "other" ? -1 : (catIndex.get(id) ?? -1) < 8 ? catIndex.get(id)! : -1,
      }))
      .sort((a, b) => b.value - a.value);
  }

  const totalsOf = (buckets: Bucket[], visitors: number) => ({
    orders: buckets.reduce((n, b) => n + b.orders, 0),
    revenue: buckets.reduce((n, b) => n + b.revenue, 0),
    customers: buckets.reduce((n, b) => n + b.customers, 0),
    visitors,
  });

  const week = dayBuckets(from.week, 7, { weekday: "short" });
  const month = dayBuckets(from.month, daysInMonth, { day: "numeric" });
  const year = monthBuckets(`${thisYear}-01`, 12);
  const weekEnd = addDays(weekStart, 6);
  const weekPeriod =
    weekStart.slice(0, 7) === weekEnd.slice(0, 7)
      ? `${fmt(weekStart, { day: "numeric" })} – ${fmt(weekEnd, { day: "numeric", month: "short", year: "numeric" })}`
      : `${fmt(weekStart, { day: "numeric", month: "short" })} – ${fmt(weekEnd, { day: "numeric", month: "short", year: "numeric" })}`;

  // All time starts at the first order, customer or visit. Under a year: one bar per month; else per year.
  const firsts = [
    ...orderMap.keys(),
    ...customerMap.keys(),
    ...(vt?.first ? [vt.first] : []),
  ].sort();
  const first = firsts[0] ?? today;
  const startMonth = first.slice(0, 7);
  const monthsSpan =
    (Number(today.slice(0, 4)) - Number(startMonth.slice(0, 4))) * 12 + (Number(today.slice(5, 7)) - Number(startMonth.slice(5, 7))) + 1;
  const allUnit = monthsSpan <= 12 ? "month" : "year";
  const all = allUnit === "month" ? monthBuckets(startMonth, monthsSpan) : yearBuckets(Number(first.slice(0, 4)), Number(today.slice(0, 4)));

  return {
    week: { period: weekPeriod, unit: "day", buckets: week, totals: totalsOf(week, vt?.week ?? 0), collections: collections(from.week) },
    month: { period: fmt(thisMonth, { month: "long", year: "numeric" }), unit: "day", buckets: month, totals: totalsOf(month, vt?.month ?? 0), collections: collections(from.month) },
    year: { period: thisYear, unit: "month", buckets: year, totals: totalsOf(year, vt?.year ?? 0), collections: collections(from.year) },
    all: { period: `Since ${fmt(startMonth, { month: "short", year: "numeric" })}`, unit: allUnit, buckets: all, totals: totalsOf(all, vt?.all ?? 0), collections: collections(null) },
  };
}
