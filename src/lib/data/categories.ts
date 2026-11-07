import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema as s } from "@/lib/db";
import { categories as fallbackCategories, type NavCategory } from "@/lib/site";

export const CATEGORIES_TAG = "categories";

function queryActiveCategories() {
  return db()
    .select({
      name: s.categories.name,
      slug: s.categories.slug,
      description: s.categories.description,
      imageUrl: s.categories.imageUrl,
    })
    .from(s.categories)
    .where(eq(s.categories.isActive, true))
    .orderBy(asc(s.categories.sortOrder), asc(s.categories.name));
}

/**
 * Active categories for the storefront (nav, menu, footer, shop pages).
 * Cached and tagged; admin edits call updateTag(CATEGORIES_TAG) to refresh.
 *
 * Resilience: retries once, then falls back to the static list. The fallback
 * is cached for "minutes" (not "seconds") on purpose — a short-lived cache is
 * treated as dynamic and would fail prerendering, so one DB hiccup during a
 * deploy build would otherwise break the whole build.
 */
export async function getStoreCategories(): Promise<NavCategory[]> {
  "use cache";
  cacheTag(CATEGORIES_TAG);
  let rows: Awaited<ReturnType<typeof queryActiveCategories>> | null = null;
  for (let attempt = 1; attempt <= 2 && !rows; attempt++) {
    try {
      rows = await queryActiveCategories();
    } catch (e) {
      console.warn(`[categories] query failed (attempt ${attempt}/2):`, e instanceof Error ? e.message : e);
    }
  }
  if (!rows) {
    console.warn("[categories] using static fallback list");
    cacheLife("minutes");
    return fallbackCategories;
  }
  cacheLife("hours");
  return rows.map((r) => ({
    name: r.name,
    slug: r.slug,
    blurb: r.description ?? "",
    imageUrl: r.imageUrl,
  }));
}

/* ───────────── Admin (uncached, always fresh) ───────────── */

export async function listCategoriesForAdmin() {
  return db()
    .select({
      id: s.categories.id,
      name: s.categories.name,
      slug: s.categories.slug,
      description: s.categories.description,
      imageUrl: s.categories.imageUrl,
      isActive: s.categories.isActive,
      // Correlated subqueries: table-qualify explicitly. Drizzle renders column
      // refs unqualified in a single-table select, so a bare `id` would bind to
      // the subquery's own table and every count would be 0.
      productCount: sql<number>`(select count(*)::int from "products" p where p."category_id" = "categories"."id")`,
      fieldCount: sql<number>`(select count(*)::int from "category_fields" f where f."category_id" = "categories"."id")`,
    })
    .from(s.categories)
    .orderBy(asc(s.categories.sortOrder), asc(s.categories.name));
}

export type AdminCategoryRow = Awaited<ReturnType<typeof listCategoriesForAdmin>>[number];

export async function getCategoryWithFields(id: string) {
  const d = db();
  const [category] = await d.select().from(s.categories).where(eq(s.categories.id, id));
  if (!category) return null;
  const fields = await d
    .select()
    .from(s.categoryFields)
    .where(eq(s.categoryFields.categoryId, id))
    .orderBy(asc(s.categoryFields.sortOrder));
  const [{ productCount }] = await d
    .select({ productCount: sql<number>`count(*)::int` })
    .from(s.products)
    .where(eq(s.products.categoryId, id));
  return { category, fields, productCount };
}
