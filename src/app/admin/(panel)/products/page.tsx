import type { Metadata } from "next";
import { cookies } from "next/headers";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { z } from "zod";
import { FabLink } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { listCategoriesForAdmin } from "@/lib/data/categories";
import { listProductsForAdmin, PRODUCT_SORTS } from "@/lib/data/products";
import { ProductFilters } from "./product-filters";
import { ProductList } from "./product-list";
import { ProductsViewProvider } from "./view-toggle";
import { PRODUCTS_VIEW_COOKIE } from "./view";

export const metadata: Metadata = { title: "Products" };

const filtersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: z.uuid().optional().catch(undefined),
  status: z.enum(["draft", "active"]).optional().catch(undefined),
  sort: z.enum(PRODUCT_SORTS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

/**
 * List/card choice for the first render. Read in a private cache like every other
 * admin read: a bare cookies() call made this page re-render on the server on
 * every visit instead of coming back instantly from the browser's cache.
 * (If it's briefly stale, the client corrects it from localStorage.)
 */
async function savedView(): Promise<"list" | "grid"> {
  "use cache: private";
  cacheLife("admin");
  return (await cookies()).get(PRODUCTS_VIEW_COOKIE)?.value === "grid" ? "grid" : "list";
}

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireAdminView();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const filters = filtersSchema.parse({ q: one(sp.q), category: one(sp.category), status: one(sp.status), sort: one(sp.sort), page: one(sp.page) });

  const [{ rows, total, page, pages }, categories] = await Promise.all([
    listProductsForAdmin(filters),
    listCategoriesForAdmin(),
  ]);
  const filtered = !!(filters.q || filters.category || filters.status);

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.category) params.set("category", filters.category);
    if (filters.status) params.set("status", filters.status);
    if (filters.sort) params.set("sort", filters.sort);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/admin/products${qs ? `?${qs}` : ""}`;
  };

  const view = await savedView();

  return (
    <ProductsViewProvider initial={view}>
      <FabLink href={filters.category ? `/admin/products/new?category=${filters.category}` : "/admin/products/new"} label="New product" />
      <ProductFilters categories={categories.map((c) => ({ id: c.id, name: c.name }))} initial={filters} />
      {total > 0 && (
        <p className="mb-2 text-xs text-mute">
          {total} {total === 1 ? "product" : "products"}
          {filtered && " found"}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-600 py-16 text-center">
          <p className="text-sm text-stone">{filtered ? "No products match these filters." : "No products yet."}</p>
          {!filtered && (
            <Link href="/admin/products/new" className="mt-3 inline-block text-sm text-gold-400 hover:underline">
              Add your first product
            </Link>
          )}
        </div>
      ) : (
        <ProductList initial={rows} />
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="rounded-md border border-ink-600 px-3 py-1.5 text-stone hover:border-gold-500/40 hover:text-gold-300">
              ← Previous
            </Link>
          ) : null}
          <span className="text-mute">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="rounded-md border border-ink-600 px-3 py-1.5 text-stone hover:border-gold-500/40 hover:text-gold-300">
              Next →
            </Link>
          ) : null}
        </nav>
      )}
    </ProductsViewProvider>
  );
}
