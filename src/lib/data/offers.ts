import "server-only";
import { asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema as s } from "@/lib/db";
import { VIDEO_URL_PG_REGEX } from "@/lib/media";
import { toIstDay } from "@/lib/validation/coupon";
import type { OfferStatus } from "@/lib/validation/offer";
import { CATEGORIES_TAG, PRODUCTS_TAG, REVIEWS_TAG, queryStoreProducts, toStoreProduct, type StoreProduct } from "./products";

/** Offer actions call updateTag(OFFERS_TAG) to refresh the homepage and offer pages. */
export const OFFERS_TAG = "offers";

const order = [asc(s.offers.sortOrder), desc(s.offers.createdAt)];

/* ───────────── Storefront ───────────── */

export type StoreOfferCard = {
  id: string;
  slug: string;
  title: string;
  coverUrl: string;
  pickCount: number;
  price: number;
  /** Live products the customer can choose from. */
  productCount: number;
};

export type StoreOffer = StoreOfferCard & {
  description: string;
  products: StoreProduct[];
};

type Window = { startsAt: Date | null; expiresAt: Date | null };

/**
 * Offers have optional start/end dates. Cached pages freeze "now", so when the
 * next start or end is close, the cache is kept only until then.
 */
function cacheUntilNextChange(rows: Window[], now: number) {
  const next = rows
    .flatMap((r) => [r.startsAt?.getTime(), r.expiresAt?.getTime()])
    .filter((t): t is number => t != null && t > now)
    .sort((a, b) => a - b)[0];
  const secs = next ? Math.ceil((next - now) / 1000) : Infinity;
  if (secs < 7200) cacheLife({ stale: 60, revalidate: Math.max(60, secs), expire: Math.max(300, secs + 60) });
  else cacheLife("store");
}

const isLive = (r: Window & { isActive: boolean }, now: number) =>
  r.isActive && (!r.startsAt || r.startsAt.getTime() <= now) && (!r.expiresAt || r.expiresAt.getTime() > now);

/** Live products in each offer (draft products and hidden categories don't count). */
const liveProductCount = sql<number>`(select count(*)::int from "offer_products" op
  join "products" p on p."id" = op."product_id"
  join "categories" c on c."id" = p."category_id"
  where op."offer_id" = "offers"."id" and p."status" = 'active' and c."is_active")`;

/** Homepage strip under the Feed: live offers that have something to choose from. */
export async function getStoreOffers(): Promise<StoreOfferCard[]> {
  "use cache";
  cacheTag(OFFERS_TAG, PRODUCTS_TAG, CATEGORIES_TAG);
  try {
    const rows = await db()
      .select({
        id: s.offers.id,
        slug: s.offers.slug,
        title: s.offers.title,
        coverUrl: s.offers.coverUrl,
        pickCount: s.offers.pickCount,
        price: s.offers.price,
        isActive: s.offers.isActive,
        startsAt: s.offers.startsAt,
        expiresAt: s.offers.expiresAt,
        productCount: liveProductCount,
      })
      .from(s.offers)
      .where(eq(s.offers.isActive, true))
      .orderBy(...order);
    const now = Date.now();
    cacheUntilNextChange(rows, now);
    return rows
      .filter((r) => isLive(r, now) && r.productCount > 0)
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        coverUrl: r.coverUrl,
        pickCount: r.pickCount,
        price: r.price,
        productCount: r.productCount,
      }));
  } catch (e) {
    console.warn("[offers] list failed:", e instanceof Error ? e.message : e);
    cacheLife("minutes");
    return [];
  }
}

/** One live offer with its products (in the admin's order), or null when it's off, ended or unknown. */
export async function getStoreOffer(slug: string): Promise<StoreOffer | null> {
  "use cache";
  cacheTag(OFFERS_TAG, PRODUCTS_TAG, CATEGORIES_TAG, REVIEWS_TAG);
  const [o] = await db().select().from(s.offers).where(eq(s.offers.slug, slug));
  const now = Date.now();
  if (!o) {
    cacheLife("minutes");
    return null;
  }
  cacheUntilNextChange([o], now);
  if (!isLive(o, now)) return null;

  const links = await db()
    .select({ productId: s.offerProducts.productId })
    .from(s.offerProducts)
    .where(eq(s.offerProducts.offerId, o.id))
    .orderBy(asc(s.offerProducts.sortOrder));
  const ids = links.map((l) => l.productId);
  const rows = ids.length ? await queryStoreProducts(inArray(s.products.id, ids)) : [];
  const products = ids.flatMap((id) => rows.filter((r) => r.id === id).map(toStoreProduct));
  if (!products.length) return null;

  return {
    id: o.id,
    slug: o.slug,
    title: o.title,
    coverUrl: o.coverUrl,
    pickCount: o.pickCount,
    price: o.price,
    productCount: products.length,
    description: o.description ?? "",
    products,
  };
}

/* ───────────── Admin (private-cached; call after requireAdminView()) ───────────── */

async function offerRows(where?: SQL) {
  const rows = await db()
    .select({
      o: s.offers,
      started: sql<boolean>`(${s.offers.startsAt} is null or ${s.offers.startsAt} <= now())`,
      expired: sql<boolean>`(${s.offers.expiresAt} is not null and ${s.offers.expiresAt} < now())`,
      productIds: sql<string[]>`coalesce((select array_agg(op."product_id" order by op."sort_order") from "offer_products" op where op."offer_id" = "offers"."id"), '{}')`,
      liveProducts: liveProductCount,
      // Bundles sold (on orders that weren't cancelled).
      sold: sql<number>`(select count(distinct (i."order_id", i."bundle_no"))::int from "order_items" i
        join "orders" ord on ord."id" = i."order_id"
        where i."offer_id" = "offers"."id" and ord."status" <> 'cancelled')`,
    })
    .from(s.offers)
    .where(where)
    .orderBy(...order);

  return rows.map(({ o, started, expired, productIds, liveProducts, sold }) => {
    const status: OfferStatus = !o.isActive ? "off" : expired ? "expired" : !started ? "scheduled" : "active";
    return {
      id: o.id,
      slug: o.slug,
      title: o.title,
      description: o.description ?? "",
      coverUrl: o.coverUrl,
      pickCount: o.pickCount,
      price: o.price,
      productIds,
      liveProducts,
      startsOn: toIstDay(o.startsAt),
      endsOn: toIstDay(o.expiresAt),
      isActive: o.isActive,
      status,
      sold,
    };
  });
}

export type AdminOfferRow = Awaited<ReturnType<typeof offerRows>>[number];

export async function listOffersForAdmin() {
  "use cache: private";
  cacheLife("admin");
  return offerRows();
}

export async function getOfferForEdit(id: string): Promise<AdminOfferRow | null> {
  "use cache: private";
  cacheLife("admin");
  const [row] = await offerRows(eq(s.offers.id, id));
  return row ?? null;
}

/** Every product, for the offer's product picker (drafts included, marked as such). */
export async function listOfferProductOptions() {
  "use cache: private";
  cacheLife("admin");
  const rows = await db()
    .select({
      id: s.products.id,
      name: s.products.name,
      price: s.products.price,
      status: s.products.status,
      categoryName: s.categories.name,
      categoryActive: s.categories.isActive,
      image: sql<string | null>`(select i."url" from "product_images" i where i."product_id" = "products"."id" and i."url" !~* ${VIDEO_URL_PG_REGEX} order by i."sort_order" limit 1)`,
      variantCount: sql<number>`(select count(*)::int from "product_variants" v where v."product_id" = "products"."id")`,
    })
    .from(s.products)
    .innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
    .orderBy(asc(s.categories.sortOrder), asc(s.categories.name), asc(s.products.name));
  return rows.map((r) => ({ ...r, live: r.status === "active" && r.categoryActive }));
}

export type OfferProductOption = Awaited<ReturnType<typeof listOfferProductOptions>>[number];
