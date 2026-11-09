import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema as s, type Database } from "@/lib/db";
import { VIDEO_URL_PG_REGEX } from "@/lib/media";
import {
  MAX_QTY_PER_LINE,
  lineKey,
  paymentSettingsSchema,
  toCheckoutSettings,
  type CartItem,
  type CheckoutSettings,
  type PaymentSettings,
} from "@/lib/validation/checkout";
import { allocateBundle, type CartBundle } from "@/lib/validation/offer";
import { SETTINGS_TAG } from "./settings";

/* ───────────── Payment & delivery settings ───────────── */

/**
 * Stored under the settings key "payments". Before the admin saves that form
 * once, the older seeded keys (cod_enabled, cod_min_order, shipping_fee,
 * free_shipping_above) supply the defaults.
 */
async function readPaymentSettings(): Promise<PaymentSettings> {
  const rows = await db()
    .select()
    .from(s.settings)
    .where(inArray(s.settings.key, ["payments", "cod_enabled", "cod_min_order", "shipping_fee", "free_shipping_above"]));
  const v = (k: string) => rows.find((r) => r.key === k)?.value;
  const legacy = {
    codEnabled: v("cod_enabled") ?? undefined,
    codMinOrder: v("cod_min_order") ?? undefined,
    shippingFee: v("shipping_fee") ?? undefined,
    freeShippingAbove: v("free_shipping_above") ?? undefined,
  };
  const saved = (v("payments") ?? {}) as Record<string, unknown>;
  const parsed = paymentSettingsSchema.safeParse({ ...legacy, ...saved });
  return parsed.success ? parsed.data : paymentSettingsSchema.parse({});
}

export async function getCheckoutSettings(): Promise<CheckoutSettings> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("store");
  return toCheckoutSettings(await readPaymentSettings());
}

/** Admin form values (private-cached; call after requireAdminView()). */
export async function getPaymentSettingsForAdmin() {
  "use cache: private";
  cacheLife("admin");
  return readPaymentSettings();
}

/** Uncached, for placing an order (the rules must be current). */
export const readCheckoutSettingsNow = async () => toCheckoutSettings(await readPaymentSettings());

/* ───────────── Pricing a cart ───────────── */

export type CartLine = {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  categorySlug: string;
  image: string | null;
  unitPrice: number;
  compareAtPrice: number | null;
  /** What the customer asked for. */
  quantity: number;
  /** Most they can buy right now (0 = sold out / unavailable). */
  maxQty: number;
  /** Set when the line can't be bought as is. */
  issue: string | null;
  /** Internal: whether stock is counted (for the order transaction). */
  trackStock: boolean;
};

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Product + variant rows for pricing, optionally locked (inside a transaction). */
async function loadCatalog(productIds: string[], opts: { tx?: Tx; lock?: boolean }) {
  const d = opts.tx ?? db();
  if (!productIds.length) return { products: [], variants: [] };
  const productQuery = d
    .select({
      id: s.products.id,
      name: s.products.name,
      price: s.products.price,
      compareAtPrice: s.products.compareAtPrice,
      stock: s.products.stock,
      trackStock: s.products.trackStock,
      status: s.products.status,
      categoryActive: s.categories.isActive,
      categorySlug: s.categories.slug,
      image: sql<
        string | null
      >`(select i."url" from "product_images" i where i."product_id" = "products"."id" and i."url" !~* ${VIDEO_URL_PG_REGEX} order by i."sort_order" limit 1)`,
    })
    .from(s.products)
    .innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
    .where(inArray(s.products.id, productIds))
    .orderBy(asc(s.products.id));
  const variantQuery = d
    .select()
    .from(s.productVariants)
    .where(inArray(s.productVariants.productId, productIds))
    .orderBy(asc(s.productVariants.id));

  // Same lock order every time (by id) so concurrent checkouts can't deadlock.
  const [products, variants] = opts.lock
    ? [await productQuery.for("update", { of: s.products }), await variantQuery.for("update")]
    : await Promise.all([productQuery, variantQuery]);
  return { products, variants };
}

type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

/** One product line, priced and checked against its own stock. */
function priceItem(item: CartItem, { products, variants }: Catalog): CartLine {
  const p = products.find((x) => x.id === item.productId);
  const own = variants.filter((v) => v.productId === item.productId);
  const v = item.variantId ? own.find((x) => x.id === item.variantId) : undefined;
  const base: CartLine = {
    key: lineKey(item),
    productId: item.productId,
    variantId: item.variantId,
    name: p?.name ?? "Unavailable item",
    variantLabel: v?.label ?? null,
    categorySlug: p?.categorySlug ?? "",
    image: p?.image ?? null,
    unitPrice: v?.priceOverride ?? p?.price ?? 0,
    compareAtPrice: v?.priceOverride != null ? null : (p?.compareAtPrice ?? null),
    quantity: item.qty,
    maxQty: 0,
    issue: null,
    trackStock: p?.trackStock ?? true,
  };
  if (!p || p.status !== "active" || !p.categoryActive) return { ...base, issue: "No longer available" };
  if (item.variantId && !v) return { ...base, issue: "This option is no longer available" };
  if (!item.variantId && own.length) return { ...base, issue: "Choose an option" };
  const stock = !p.trackStock ? MAX_QTY_PER_LINE : (v ? v.stock : p.stock);
  const maxQty = Math.max(0, Math.min(MAX_QTY_PER_LINE, stock));
  if (maxQty === 0) return { ...base, issue: "Sold out" };
  if (item.qty > maxQty) return { ...base, maxQty, issue: `Only ${maxQty} left` };
  return { ...base, maxQty };
}

/** A product+variant asked for twice (two tabs) counts once, with both quantities. */
function mergeItems(items: CartItem[]) {
  const merged = new Map<string, CartItem>();
  for (const i of items) {
    const k = lineKey(i);
    const prev = merged.get(k);
    merged.set(k, prev ? { ...i, qty: Math.min(MAX_QTY_PER_LINE, prev.qty + i.qty) } : i);
  }
  return [...merged.values()];
}

/**
 * Live prices and stock for the items in a bag. The browser only ever sends
 * ids and quantities; everything else comes from here. With `lock`, the
 * product and variant rows are locked (inside a transaction) so two orders
 * can't sell the same last piece.
 */
export async function priceCart(items: CartItem[], opts: { tx?: Tx; lock?: boolean } = {}): Promise<CartLine[]> {
  const catalog = await loadCatalog([...new Set(items.map((i) => i.productId))], opts);
  return mergeItems(items).map((item) => priceItem(item, catalog));
}

/* ───────────── Offer bundles in the bag ───────────── */

export type BundlePick = {
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  image: string | null;
  categorySlug: string;
  /** The item's normal price. */
  listPrice: number;
  /** Its share of the offer price (what goes on the order). */
  price: number;
  trackStock: boolean;
};

export type BundleLine = {
  /** The bundle's id in the bag. */
  id: string;
  offerId: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  /** The offer price for the whole bundle. */
  price: number;
  pickCount: number;
  picks: BundlePick[];
  /** The picks at their normal prices (to show the saving). */
  listTotal: number;
  /** Set when the bundle can't be bought as is. */
  issue: string | null;
};

/**
 * Prices a whole bag: product lines (full price) and offer bundles (offer
 * price, split over their items). Stock is checked across both, so a piece
 * can't be sold twice, once on its own and once in an offer.
 */
export async function priceBag(
  items: CartItem[],
  bundles: CartBundle[],
  opts: { tx?: Tx; lock?: boolean } = {},
): Promise<{ lines: CartLine[]; bundles: BundleLine[] }> {
  const productIds = [...new Set([...items.map((i) => i.productId), ...bundles.flatMap((b) => b.picks.map((p) => p.productId))])];
  const d = opts.tx ?? db();
  const offerIds = [...new Set(bundles.map((b) => b.offerId))];
  const [catalog, offerRows, offerProductRows] = await Promise.all([
    loadCatalog(productIds, opts),
    offerIds.length ? d.select().from(s.offers).where(inArray(s.offers.id, offerIds)) : Promise.resolve([]),
    offerIds.length
      ? d.select({ offerId: s.offerProducts.offerId, productId: s.offerProducts.productId }).from(s.offerProducts).where(inArray(s.offerProducts.offerId, offerIds))
      : Promise.resolve([]),
  ]);

  const lines = mergeItems(items).map((item) => priceItem(item, catalog));

  // What's left for offers once the product lines have their pieces.
  const left = new Map<string, number>();
  const stockOf = (productId: string, variantId: string | null) => {
    const k = lineKey({ productId, variantId });
    if (!left.has(k)) {
      const p = catalog.products.find((x) => x.id === productId);
      const v = variantId ? catalog.variants.find((x) => x.id === variantId) : undefined;
      left.set(k, !p ? 0 : !p.trackStock ? Infinity : v ? v.stock : p.stock);
    }
    return k;
  };
  for (const l of lines) {
    if (l.issue) continue;
    const k = stockOf(l.productId, l.variantId);
    left.set(k, left.get(k)! - l.quantity);
  }

  const now = Date.now();
  const priced = bundles.map((b): BundleLine => {
    const o = offerRows.find((x) => x.id === b.offerId);
    const picks = b.picks.map((pick) => {
      const line = priceItem({ ...pick, qty: 1 }, catalog);
      return { line, pick };
    });
    const listPrices = picks.map((x) => x.line.unitPrice);
    const shares = allocateBundle(o?.price ?? 0, listPrices);
    const base: BundleLine = {
      id: b.id,
      offerId: b.offerId,
      slug: o?.slug ?? "",
      title: o?.title ?? "Offer",
      coverUrl: o?.coverUrl ?? null,
      price: o?.price ?? 0,
      pickCount: o?.pickCount ?? b.picks.length,
      picks: picks.map(({ line }, i) => ({
        productId: line.productId,
        variantId: line.variantId,
        name: line.name,
        variantLabel: line.variantLabel,
        image: line.image,
        categorySlug: line.categorySlug,
        listPrice: line.unitPrice,
        price: shares[i] ?? 0,
        trackStock: line.trackStock,
      })),
      listTotal: listPrices.reduce((a, c) => a + c, 0),
      issue: null,
    };
    const live =
      !!o && o.isActive && (!o.startsAt || o.startsAt.getTime() <= now) && (!o.expiresAt || o.expiresAt.getTime() > now);
    if (!live) return { ...base, issue: "This offer has ended" };
    if (b.picks.length !== o.pickCount) return { ...base, issue: `Choose ${o.pickCount} items for this offer` };
    const allowed = new Set(offerProductRows.filter((r) => r.offerId === o.id).map((r) => r.productId));
    const outside = picks.find(({ pick }) => !allowed.has(pick.productId));
    if (outside) return { ...base, issue: `${outside.line.name} is no longer part of this offer` };
    const broken = picks.find(({ line }) => line.issue && line.issue !== "Sold out");
    if (broken) return { ...base, issue: `${broken.line.name}: ${broken.line.issue!.toLowerCase()}` };

    // Stock, across the product lines and the bundles before this one.
    const need = new Map<string, { n: number; name: string }>();
    for (const { line } of picks) {
      const k = stockOf(line.productId, line.variantId);
      need.set(k, { n: (need.get(k)?.n ?? 0) + 1, name: line.name });
    }
    for (const [k, { n, name }] of need) {
      const has = left.get(k)!;
      if (has < n) return { ...base, issue: has <= 0 ? `${name} is sold out` : `Only ${has} of ${name} left` };
    }
    for (const [k, { n }] of need) left.set(k, left.get(k)! - n);
    return base;
  });

  return { lines, bundles: priced };
}

/** Takes the bought quantities out of stock (or puts them back with sign = 1). Products and their variants both. */
export async function adjustStock(
  tx: Tx,
  lines: { productId: string | null; variantId: string | null; quantity: number }[],
  sign: -1 | 1,
) {
  for (const l of lines) {
    if (!l.productId) continue;
    const delta = sign * l.quantity;
    await tx
      .update(s.products)
      .set({ stock: sql`greatest(0, ${s.products.stock} + ${delta})` })
      .where(and(eq(s.products.id, l.productId), eq(s.products.trackStock, true)));
    if (l.variantId) {
      await tx
        .update(s.productVariants)
        .set({ stock: sql`greatest(0, ${s.productVariants.stock} + ${delta})` })
        .where(
          and(
            eq(s.productVariants.id, l.variantId),
            sql`exists (select 1 from "products" p where p."id" = ${l.productId} and p."track_stock")`,
          ),
        );
    }
  }
}
