import "server-only";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema as s } from "@/lib/db";
import { VIDEO_URL_PG_REGEX } from "@/lib/media";

/** First photo of a product (videos skipped), for cards and lists. Table-qualified on purpose (see listCategoriesForAdmin). */
const coverImageSql = sql<string | null>`(select i."url" from "product_images" i where i."product_id" = "products"."id" and i."url" !~* ${VIDEO_URL_PG_REGEX} order by i."sort_order" limit 1)`;

export const PRODUCTS_TAG = "products";
/** Same value as CATEGORIES_TAG in ./categories (not imported, to avoid a cycle). */
const CATEGORIES_TAG = "categories";
/** Card ratings come from approved reviews; the reviews module invalidates this tag. */
const REVIEWS_TAG = "reviews";

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
  /** Average of approved reviews; null until the first one. */
  rating: number | null;
  reviewCount: number;
};

function queryStoreProducts(where?: SQL) {
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
      rating: sql<number | null>`(select round(avg(r."rating")::numeric, 1)::float from "reviews" r where r."product_id" = "products"."id" and r."is_approved")`,
      reviewCount: sql<number>`(select count(*)::int from "reviews" r where r."product_id" = "products"."id" and r."is_approved")`,
    })
    .from(s.products)
    .innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
    .where(and(eq(s.products.status, "active"), eq(s.categories.isActive, true), where));
}

function toStoreProduct(r: Awaited<ReturnType<typeof queryStoreProducts>>[number]): StoreProduct {
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
    rating: r.rating,
    reviewCount: r.reviewCount,
  };
}

export async function getCategoryProducts(categorySlug: string): Promise<StoreProduct[]> {
  "use cache";
  cacheTag(PRODUCTS_TAG, CATEGORIES_TAG, REVIEWS_TAG);
  cacheLife("hours");
  const rows = await queryStoreProducts(eq(s.categories.slug, categorySlug)).orderBy(
    desc(s.products.createdAt),
    asc(s.products.name),
  );
  return rows.map(toStoreProduct);
}

/** Homepage "Best Sellers": products marked Featured in admin, in their set order. */
export async function getFeaturedProducts(limit = 8): Promise<StoreProduct[]> {
  "use cache";
  cacheTag(PRODUCTS_TAG, CATEGORIES_TAG, REVIEWS_TAG);
  cacheLife("hours");
  const rows = await queryStoreProducts(eq(s.products.isFeatured, true))
    .orderBy(asc(s.products.featuredOrder), desc(s.products.createdAt))
    .limit(limit);
  return rows.map(toStoreProduct);
}

/** Live product count per category slug (Shop page tiles). */
export async function getProductCounts(): Promise<Record<string, number>> {
  "use cache";
  cacheTag(PRODUCTS_TAG, CATEGORIES_TAG, REVIEWS_TAG);
  cacheLife("hours");
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
