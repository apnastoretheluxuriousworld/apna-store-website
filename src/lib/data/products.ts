import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema as s } from "@/lib/db";
import { VIDEO_URL_PG_REGEX, isVideoUrl } from "@/lib/media";

/** First photo of a product (videos skipped), for cards and lists. Table-qualified on purpose (see listCategoriesForAdmin). */
const coverImageSql = sql<string | null>`(select i."url" from "product_images" i where i."product_id" = "products"."id" and i."url" !~* ${VIDEO_URL_PG_REGEX} order by i."sort_order" limit 1)`;

export const PRODUCTS_TAG = "products";
/** Same value as CATEGORIES_TAG in ./categories (not imported, to avoid a cycle). */
export const CATEGORIES_TAG = "categories";
/** Card ratings come from approved reviews; the reviews module invalidates this tag. */
export const REVIEWS_TAG = "reviews";

/*
 * ───────────── Storefront ─────────────
 * Only Live products in visible categories. Cached on the server and tagged:
 * product actions call updateTag(PRODUCTS_TAG), category actions
 * updateTag(CATEGORIES_TAG) — either refreshes these lists.
 */

export type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  /** First line of the description, shown under the name on cards. */
  subtitle: string;
  categorySlug: string;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  inStock: boolean;
  /** Most that can go in the bag (stock, capped by the bag's per-line limit); null = not counted. */
  stockLeft: number | null;
  /** Sizes / options. When there are any, the customer must pick one. */
  variants: StoreVariant[];
  /** Average of approved reviews; null until the first one. */
  rating: number | null;
  reviewCount: number;
};

export type StoreVariant = { id: string; label: string; price: number; stockLeft: number | null };

type VariantRow = { id: string; label: string; price: number; stock: number };

export function queryStoreProducts(where?: SQL) {
  return db()
    .select({
      id: s.products.id,
      slug: s.products.slug,
      name: s.products.name,
      description: s.products.description,
      categorySlug: s.categories.slug,
      price: s.products.price,
      compareAtPrice: s.products.compareAtPrice,
      stock: s.products.stock,
      trackStock: s.products.trackStock,
      image: coverImageSql,
      variants: sql<VariantRow[]>`coalesce((select json_agg(json_build_object('id', v."id", 'label', v."label", 'price', coalesce(v."price_override", "products"."price"), 'stock', v."stock") order by v."sort_order", v."id") from "product_variants" v where v."product_id" = "products"."id"), '[]'::json)`,
      rating: sql<number | null>`(select round(avg(r."rating")::numeric, 1)::float from "reviews" r where r."product_id" = "products"."id" and r."is_approved")`,
      reviewCount: sql<number>`(select count(*)::int from "reviews" r where r."product_id" = "products"."id" and r."is_approved")`,
    })
    .from(s.products)
    .innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
    .where(and(eq(s.products.status, "active"), eq(s.categories.isActive, true), where));
}

export function toStoreProduct(r: Awaited<ReturnType<typeof queryStoreProducts>>[number]): StoreProduct {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    subtitle: (r.description ?? "").split("\n")[0].trim(),
    categorySlug: r.categorySlug,
    price: r.price,
    compareAtPrice: r.compareAtPrice,
    image: r.image,
    inStock: !r.trackStock || r.stock > 0,
    stockLeft: r.trackStock ? r.stock : null,
    variants: r.variants.map((v) => ({ id: v.id, label: v.label, price: v.price, stockLeft: r.trackStock ? v.stock : null })),
    rating: r.rating,
    reviewCount: r.reviewCount,
  };
}

/** Products per "page" on a collection page (first render and each "Load more"). */
export const CATEGORY_PAGE_SIZE = 20;

/** One page of a collection, newest first; `hasMore` says whether "Load more" has anything left. */
export async function getCategoryProductsPage(
  categorySlug: string,
  offset = 0,
): Promise<{ products: StoreProduct[]; hasMore: boolean }> {
  "use cache";
  cacheTag(PRODUCTS_TAG, CATEGORIES_TAG, REVIEWS_TAG);
  cacheLife("store");
  // One extra row tells us if another page exists; id breaks ties so pages never overlap.
  const rows = await queryStoreProducts(eq(s.categories.slug, categorySlug))
    .orderBy(desc(s.products.createdAt), asc(s.products.name), asc(s.products.id))
    .limit(CATEGORY_PAGE_SIZE + 1)
    .offset(offset);
  return { products: rows.slice(0, CATEGORY_PAGE_SIZE).map(toStoreProduct), hasMore: rows.length > CATEGORY_PAGE_SIZE };
}

/** Homepage "Best Sellers": products marked Featured in admin, in their set order. */
export async function getFeaturedProducts(limit = 8): Promise<StoreProduct[]> {
  "use cache";
  cacheTag(PRODUCTS_TAG, CATEGORIES_TAG, REVIEWS_TAG);
  cacheLife("store");
  const rows = await queryStoreProducts(eq(s.products.isFeatured, true))
    .orderBy(asc(s.products.featuredOrder), desc(s.products.createdAt))
    .limit(limit);
  return rows.map(toStoreProduct);
}

/* ───────────── Product page ───────────── */

export type ProductMedia = { type: "image" | "video"; url: string; alt: string };
export type ProductSpec = { label: string; value: string };

export type StoreProductDetail = StoreProduct & {
  description: string;
  categoryName: string;
  sku: string | null;
  /** Photos and videos in the admin's order. */
  media: ProductMedia[];
  /** Category fields (in their order) with values, then the product's own extras. */
  specs: ProductSpec[];
};


function formatSpec(type: string, value: unknown, unit: string | null) {
  if (value === null || value === undefined || value === "") return null;
  if (type === "boolean") return value === true || value === "true" ? "Yes" : value === false || value === "false" ? "No" : null;
  const v = String(value).trim();
  if (!v) return null;
  return unit ? `${v} ${unit}` : v;
}

/** One live product by its URL slug, with gallery, specs and options; null if missing or not for sale. */
export async function getStoreProductDetail(slug: string): Promise<StoreProductDetail | null> {
  "use cache";
  cacheTag(PRODUCTS_TAG, CATEGORIES_TAG, REVIEWS_TAG);
  cacheLife("store");
  const [row] = await queryStoreProducts(eq(s.products.slug, slug)).limit(1);
  if (!row) return null;
  const d = db();
  const [[extra], images, fields] = await Promise.all([
    d
      .select({
        sku: s.products.sku,
        attributes: s.products.attributes,
        customAttributes: s.products.customAttributes,
        categoryId: s.products.categoryId,
        categoryName: s.categories.name,
      })
      .from(s.products)
      .innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
      .where(eq(s.products.id, row.id)),
    d
      .select({ url: s.productImages.url, alt: s.productImages.alt })
      .from(s.productImages)
      .where(eq(s.productImages.productId, row.id))
      .orderBy(asc(s.productImages.sortOrder)),
    d
      .select({ key: s.categoryFields.key, label: s.categoryFields.label, type: s.categoryFields.type, unit: s.categoryFields.unit })
      .from(s.categoryFields)
      .innerJoin(s.products, eq(s.products.categoryId, s.categoryFields.categoryId))
      .where(eq(s.products.id, row.id))
      .orderBy(asc(s.categoryFields.sortOrder)),
  ]);
  const specs: ProductSpec[] = [
    ...fields.flatMap((f) => {
      const value = formatSpec(f.type, extra.attributes[f.key], f.unit);
      return value ? [{ label: f.label, value }] : [];
    }),
    ...extra.customAttributes.filter((a) => a.name.trim() && a.value.trim()).map((a) => ({ label: a.name.trim(), value: a.value.trim() })),
  ];
  return {
    ...toStoreProduct(row),
    description: (row.description ?? "").trim(),
    categoryName: extra.categoryName,
    sku: extra.sku,
    media: images.map((i) => ({ type: isVideoUrl(i.url) ? "video" : "image", url: i.url, alt: i.alt || row.name })),
    specs,
  };
}

/** "You may also like": other live pieces from the same collection, Featured first. */
export async function getRelatedProducts(categorySlug: string, excludeId: string, limit = 8): Promise<StoreProduct[]> {
  "use cache";
  cacheTag(PRODUCTS_TAG, CATEGORIES_TAG, REVIEWS_TAG);
  cacheLife("store");
  const rows = await queryStoreProducts(and(eq(s.categories.slug, categorySlug), sql`${s.products.id} <> ${excludeId}`))
    .orderBy(desc(s.products.isFeatured), asc(s.products.featuredOrder), desc(s.products.createdAt))
    .limit(limit);
  return rows.map(toStoreProduct);
}

/** Most products a storefront search returns. */
export const SEARCH_LIMIT = 40;

/**
 * Storefront search: live products whose name, description, brand, SKU or
 * collection matches every word typed (any order). Name matches rank first.
 */
export async function searchStoreProducts(query: string): Promise<StoreProduct[]> {
  "use cache";
  cacheTag(PRODUCTS_TAG, CATEGORIES_TAG, REVIEWS_TAG);
  cacheLife("store");
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  if (!words.length) return [];
  const esc = (w: string) => `%${w.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const haystack = sql`concat_ws(' ', ${s.products.name}, ${s.products.description}, ${s.products.sku}, ${s.categories.name}, ${s.products.attributes}->>'brand')`;
  const rows = await queryStoreProducts(and(...words.map((w) => sql`${haystack} ilike ${esc(w)}`)))
    .orderBy(
      sql`case when ${s.products.name} ilike ${esc(words.join(" "))} then 0 when ${s.products.name} ilike ${esc(words[0])} then 1 else 2 end`,
      desc(s.products.isFeatured),
      desc(s.products.createdAt),
    )
    .limit(SEARCH_LIMIT);
  return rows.map(toStoreProduct);
}

/** Most products shown in a homepage collection row. */
export const COLLECTION_ROW_LIMIT = 10;

/** Homepage collection row: the collection's Featured products first (in their set order), then its newest. */
export async function getCollectionRowProducts(categorySlug: string): Promise<StoreProduct[]> {
  "use cache";
  cacheTag(PRODUCTS_TAG, CATEGORIES_TAG, REVIEWS_TAG);
  cacheLife("store");
  const rows = await queryStoreProducts(eq(s.categories.slug, categorySlug))
    .orderBy(desc(s.products.isFeatured), asc(s.products.featuredOrder), desc(s.products.createdAt), asc(s.products.name))
    .limit(COLLECTION_ROW_LIMIT);
  return rows.map(toStoreProduct);
}

/** Live product count per category slug (Shop page tiles). */
export async function getProductCounts(): Promise<Record<string, number>> {
  "use cache";
  cacheTag(PRODUCTS_TAG, CATEGORIES_TAG, REVIEWS_TAG);
  cacheLife("store");
  const rows = await db()
    .select({ slug: s.categories.slug, n: sql<number>`count(*)::int` })
    .from(s.products)
    .innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
    .where(eq(s.products.status, "active"))
    .groupBy(s.categories.slug);
  return Object.fromEntries(rows.map((r) => [r.slug, r.n]));
}

/*
 * ───────────── Admin ─────────────
 * Private-cached ('use cache: private' + the `admin` cacheLife profile): never
 * stored on the server, only kept with the rendered page in the admin's
 * browser so page-to-page navigation is instant. Admin Server Actions call
 * revalidatePath("/admin", "layout"), which clears that browser cache.
 * Only call these after requireAdminView() — they don't check the session.
 */

export const ADMIN_PAGE_SIZE = 30;

export const PRODUCT_SORTS = ["newest", "price_asc", "price_desc", "stock_asc", "stock_desc"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export type AdminProductFilters = {
  q?: string;
  category?: string; // category id
  status?: "draft" | "active";
  sort?: ProductSort; // default: newest
  page?: number;
};

const adminOrder = {
  newest: [desc(s.products.updatedAt)],
  price_asc: [asc(s.products.price)],
  price_desc: [desc(s.products.price)],
  stock_asc: [asc(s.products.stock)],
  stock_desc: [desc(s.products.stock)],
} satisfies Record<ProductSort, SQL[]>;

export async function listProductsForAdmin(f: AdminProductFilters) {
  "use cache: private";
  cacheLife("admin");
  const where: SQL[] = [];
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(s.products.name, like), ilike(s.products.sku, like))!);
  }
  if (f.category) where.push(eq(s.products.categoryId, f.category));
  if (f.status) where.push(eq(s.products.status, f.status));
  const cond = where.length ? and(...where) : undefined;
  const page = Math.max(1, f.page ?? 1);

  const d = db();
  const [rows, [{ total }]] = await Promise.all([
    d
      .select({
        id: s.products.id,
        name: s.products.name,
        slug: s.products.slug,
        sku: s.products.sku,
        price: s.products.price,
        compareAtPrice: s.products.compareAtPrice,
        stock: s.products.stock,
        trackStock: s.products.trackStock,
        status: s.products.status,
        isFeatured: s.products.isFeatured,
        updatedAt: s.products.updatedAt,
        categoryName: s.categories.name,
        // Table-qualified on purpose (see listCategoriesForAdmin).
        imageUrl: coverImageSql,
        variantCount: sql<number>`(select count(*)::int from "product_variants" v where v."product_id" = "products"."id")`,
      })
      .from(s.products)
      .innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
      .where(cond)
      .orderBy(...adminOrder[f.sort ?? "newest"], asc(s.products.name), asc(s.products.id))
      .limit(ADMIN_PAGE_SIZE)
      .offset((page - 1) * ADMIN_PAGE_SIZE),
    d.select({ total: sql<number>`count(*)::int` }).from(s.products).where(cond),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
}

export type AdminProductRow = Awaited<ReturnType<typeof listProductsForAdmin>>["rows"][number];

/** Every category with its field definitions, for the product form. */
export async function listCategoriesWithFields() {
  "use cache: private";
  cacheLife("admin");
  const d = db();
  const [cats, fields] = await Promise.all([
    d
      .select({ id: s.categories.id, name: s.categories.name, isActive: s.categories.isActive })
      .from(s.categories)
      .orderBy(asc(s.categories.sortOrder), asc(s.categories.name)),
    d
      .select({
        categoryId: s.categoryFields.categoryId,
        key: s.categoryFields.key,
        label: s.categoryFields.label,
        type: s.categoryFields.type,
        options: s.categoryFields.options,
        unit: s.categoryFields.unit,
        required: s.categoryFields.required,
      })
      .from(s.categoryFields)
      .orderBy(asc(s.categoryFields.sortOrder)),
  ]);
  return cats.map((c) => ({
    ...c,
    fields: fields
      .filter((f) => f.categoryId === c.id)
      .map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options, unit: f.unit, required: f.required })),
  }));
}

export type CategoryWithFields = Awaited<ReturnType<typeof listCategoriesWithFields>>[number];

export async function getProductForEdit(id: string) {
  "use cache: private";
  cacheLife("admin");
  const d = db();
  const [product] = await d.select().from(s.products).where(eq(s.products.id, id));
  if (!product) return null;
  const [images, variants] = await Promise.all([
    d
      .select({ url: s.productImages.url, alt: s.productImages.alt })
      .from(s.productImages)
      .where(eq(s.productImages.productId, id))
      .orderBy(asc(s.productImages.sortOrder)),
    d
      .select()
      .from(s.productVariants)
      .where(eq(s.productVariants.productId, id))
      .orderBy(asc(s.productVariants.sortOrder)),
  ]);
  return { product, images, variants };
}
