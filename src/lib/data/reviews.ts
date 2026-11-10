import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema as s } from "@/lib/db";
import type { ReviewMedia } from "@/lib/db/schema";
import { VIDEO_URL_PG_REGEX } from "@/lib/media";
import { REVIEWABLE_ORDER_STATUSES, type ReviewStatus } from "@/lib/validation/review";

/**
 * Cache tag for everything that shows reviews. Review actions call
 * updateTag(REVIEWS_TAG); the storefront product queries in ./products also
 * carry it, so card ratings refresh when a review is published or removed.
 */
export const REVIEWS_TAG = "reviews";

/*
 * ───────────── Storefront ─────────────
 * Only published (approved) reviews.
 */

export type StoreReview = {
  id: string;
  authorName: string;
  city: string | null;
  rating: number;
  body: string | null;
  media: ReviewMedia[];
  isVerified: boolean;
  isPinned: boolean;
  createdAt: string; // ISO — cached values must be plain data
};

export type ReviewSummary = {
  average: number | null;
  count: number;
  /** Number of reviews per star, index 0 = 1★ … index 4 = 5★. */
  distribution: [number, number, number, number, number];
  mediaCount: number;
};

export const STORE_REVIEWS_LIMIT = 60;

/** Published reviews of one product: pinned first, then newest. */
export async function getProductReviews(productId: string): Promise<{ summary: ReviewSummary; reviews: StoreReview[] }> {
  "use cache";
  cacheTag(REVIEWS_TAG);
  cacheLife("store");
  const d = db();
  const published = and(eq(s.reviews.productId, productId), eq(s.reviews.isApproved, true));
  const [rows, stats] = await Promise.all([
    d
      .select({
        id: s.reviews.id,
        authorName: s.reviews.authorName,
        city: s.reviews.city,
        rating: s.reviews.rating,
        body: s.reviews.body,
        media: s.reviews.media,
        isVerified: s.reviews.isVerified,
        isPinned: s.reviews.isPinned,
        createdAt: s.reviews.createdAt,
      })
      .from(s.reviews)
      .where(published)
      .orderBy(desc(s.reviews.isPinned), desc(s.reviews.createdAt))
      .limit(STORE_REVIEWS_LIMIT),
    d
      .select({
        rating: s.reviews.rating,
        n: sql<number>`count(*)::int`,
        media: sql<number>`coalesce(sum(jsonb_array_length(${s.reviews.media})), 0)::int`,
      })
      .from(s.reviews)
      .where(published)
      .groupBy(s.reviews.rating),
  ]);

  const distribution: ReviewSummary["distribution"] = [0, 0, 0, 0, 0];
  let total = 0;
  let count = 0;
  let mediaCount = 0;
  for (const r of stats) {
    distribution[r.rating - 1] = r.n;
    total += r.rating * r.n;
    count += r.n;
    mediaCount += r.media;
  }

  return {
    summary: { average: count ? Math.round((total / count) * 10) / 10 : null, count, distribution, mediaCount },
    reviews: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };
}

/*
 * ───────────── Customer (signed in) ─────────────
 * A customer may review a product once one of their orders containing it has
 * shipped. One review per product; editing it sends it back for approval.
 */

/** City from the latest shipped order with this product, or null if they can't review it. */
async function reviewableOrderCity(userId: string, productId: string): Promise<{ city: string | null } | null> {
  const [row] = await db()
    .select({ city: sql<string | null>`${s.orders.shippingAddress}->>'city'` })
    .from(s.orders)
    .innerJoin(s.orderItems, eq(s.orderItems.orderId, s.orders.id))
    .where(
      and(
        eq(s.orders.userId, userId),
        eq(s.orderItems.productId, productId),
        inArray(s.orders.status, [...REVIEWABLE_ORDER_STATUSES]),
      ),
    )
    .orderBy(desc(s.orders.createdAt))
    .limit(1);
  return row ?? null;
}

/** For Server Actions: checked fresh on every submit (never cached). */
export async function canCustomerReview(userId: string, productId: string) {
  return reviewableOrderCity(userId, productId);
}

/**
 * Whether the customer has any order they could review (shipped or delivered).
 * Gates review photo/video uploads, so an account that never bought anything
 * can't use the store's bucket to host files.
 */
export async function hasReviewableOrder(userId: string) {
  const [row] = await db()
    .select({ id: s.orders.id })
    .from(s.orders)
    .where(and(eq(s.orders.userId, userId), inArray(s.orders.status, [...REVIEWABLE_ORDER_STATUSES])))
    .limit(1);
  return !!row;
}

/** The review page: product, the customer's existing review, or null if not allowed. */
export async function getReviewTarget(userId: string, productId: string) {
  "use cache: private";
  cacheLife("account");
  const d = db();
  const [allowed, [product], [existing]] = await Promise.all([
    reviewableOrderCity(userId, productId),
    d
      .select({
        id: s.products.id,
        name: s.products.name,
        image: sql<string | null>`(select i."url" from "product_images" i where i."product_id" = "products"."id" and i."url" !~* ${VIDEO_URL_PG_REGEX} order by i."sort_order" limit 1)`,
      })
      .from(s.products)
      .where(eq(s.products.id, productId)),
    d
      .select({ rating: s.reviews.rating, body: s.reviews.body, media: s.reviews.media, isApproved: s.reviews.isApproved })
      .from(s.reviews)
      .where(and(eq(s.reviews.userId, userId), eq(s.reviews.productId, productId))),
  ]);
  if (!allowed || !product) return null;
  return { product, review: existing ?? null };
}

/** Which of these products the customer has already reviewed (for "Write" vs "Edit"). */
export async function getMyReviewedProductIds(userId: string, productIds: string[]): Promise<string[]> {
  if (!productIds.length) return [];
  const rows = await db()
    .select({ productId: s.reviews.productId })
    .from(s.reviews)
    .where(and(eq(s.reviews.userId, userId), inArray(s.reviews.productId, productIds)));
  return rows.map((r) => r.productId);
}

/** Product page button: "write", "edit", or null when this customer can't review it. */
export async function getReviewAction(userId: string, productId: string): Promise<"write" | "edit" | null> {
  const [allowed, done] = await Promise.all([reviewableOrderCity(userId, productId), getMyReviewedProductIds(userId, [productId])]);
  if (!allowed) return null;
  return done.length ? "edit" : "write";
}

/** Admin menu badge + dashboard tile. */
export async function countPendingReviews() {
  "use cache: private";
  cacheLife("admin");
  return countPendingReviewsNow();
}

/** Same count, never cached: for the admin's live check (the "More" dot). */
export async function countPendingReviewsNow() {
  const [row] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(s.reviews)
    .where(eq(s.reviews.isApproved, false));
  return row?.n ?? 0;
}

/*
 * ───────────── Admin ─────────────
 * Private-cached like the other admin reads (see ./products). Only call
 * after requireAdminView().
 */

export const ADMIN_REVIEWS_PAGE_SIZE = 20;

export type AdminReviewFilters = {
  status?: ReviewStatus;
  q?: string;
  rating?: number;
  media?: "with";
  page?: number;
};

export async function listReviewsForAdmin(f: AdminReviewFilters) {
  "use cache: private";
  cacheLife("admin");
  const where: SQL[] = [];
  if (f.status) where.push(eq(s.reviews.isApproved, f.status === "published"));
  if (f.rating) where.push(eq(s.reviews.rating, f.rating));
  if (f.media) where.push(sql`jsonb_array_length(${s.reviews.media}) > 0`);
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(or(ilike(s.reviews.authorName, like), ilike(s.reviews.body, like), ilike(s.products.name, like))!);
  }
  const cond = where.length ? and(...where) : undefined;
  const page = Math.max(1, f.page ?? 1);

  const d = db();
  const [rows, [{ total }], counts] = await Promise.all([
    d
      .select({
        id: s.reviews.id,
        authorName: s.reviews.authorName,
        city: s.reviews.city,
        rating: s.reviews.rating,
        body: s.reviews.body,
        media: s.reviews.media,
        isApproved: s.reviews.isApproved,
        isPinned: s.reviews.isPinned,
        isVerified: s.reviews.isVerified,
        fromCustomer: sql<boolean>`${s.reviews.userId} is not null`,
        createdAt: s.reviews.createdAt,
        productId: s.products.id,
        productName: s.products.name,
        productSlug: s.products.slug,
        // Table-qualified on purpose (see listCategoriesForAdmin).
        productImage: sql<string | null>`(select i."url" from "product_images" i where i."product_id" = "products"."id" order by i."sort_order" limit 1)`,
      })
      .from(s.reviews)
      .innerJoin(s.products, eq(s.products.id, s.reviews.productId))
      .where(cond)
      // Pending first: they are the ones that need attention.
      .orderBy(asc(s.reviews.isApproved), desc(s.reviews.createdAt))
      .limit(ADMIN_REVIEWS_PAGE_SIZE)
      .offset((page - 1) * ADMIN_REVIEWS_PAGE_SIZE),
    d
      .select({ total: sql<number>`count(*)::int` })
      .from(s.reviews)
      .innerJoin(s.products, eq(s.products.id, s.reviews.productId))
      .where(cond),
    d
      .select({ isApproved: s.reviews.isApproved, n: sql<number>`count(*)::int` })
      .from(s.reviews)
      .groupBy(s.reviews.isApproved),
  ]);

  return {
    rows,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / ADMIN_REVIEWS_PAGE_SIZE)),
    pending: counts.find((c) => !c.isApproved)?.n ?? 0,
    published: counts.find((c) => c.isApproved)?.n ?? 0,
  };
}

export type AdminReviewRow = Awaited<ReturnType<typeof listReviewsForAdmin>>["rows"][number];

export async function getReviewForEdit(id: string) {
  "use cache: private";
  cacheLife("admin");
  const [row] = await db().select().from(s.reviews).where(eq(s.reviews.id, id));
  return row ?? null;
}

/** Products for the review form's picker, grouped by category. */
export async function listProductOptions() {
  "use cache: private";
  cacheLife("admin");
  return db()
    .select({ id: s.products.id, name: s.products.name, status: s.products.status, categoryName: s.categories.name })
    .from(s.products)
    .innerJoin(s.categories, eq(s.categories.id, s.products.categoryId))
    .orderBy(asc(s.categories.sortOrder), asc(s.categories.name), asc(s.products.name));
}

export type ProductOption = Awaited<ReturnType<typeof listProductOptions>>[number];
