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

/**
 * Live prices and stock for the items in a bag. The browser only ever sends
 * ids and quantities; everything else comes from here. With `lock`, the
 * product and variant rows are locked (inside a transaction) so two orders
 * can't sell the same last piece.
 */
export async function priceCart(items: CartItem[], opts: { tx?: Tx; lock?: boolean } = {}): Promise<CartLine[]> {
  const d = opts.tx ?? db();
  const productIds = [...new Set(items.map((i) => i.productId))];
  if (!productIds.length) return [];

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

  // A product+variant asked for twice (two tabs) counts once, with both quantities.
  const merged = new Map<string, CartItem>();
  for (const i of items) {
    const k = lineKey(i);
    const prev = merged.get(k);
    merged.set(k, prev ? { ...i, qty: Math.min(MAX_QTY_PER_LINE, prev.qty + i.qty) } : i);
  }

  return [...merged.values()].map((item): CartLine => {
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
  });
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
