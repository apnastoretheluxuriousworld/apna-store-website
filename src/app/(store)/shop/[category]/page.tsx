import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Reveal } from "@/components/motion/reveal";
import { CategoryGrid } from "@/components/product/category-grid";
import { CollectionRow } from "@/components/product/collection-row";
import { getStoreCategories } from "@/lib/data/categories";
import { getCategoryProductsPage, getCollectionRowProducts, getProductCounts } from "@/lib/data/products";
import { CategorySkeleton } from "@/components/ui/skeleton";

/** Navigations here must show the page at once; `next dev` reports anything that blocks. */
export const instant = true;

export async function generateMetadata({ params }: PageProps<"/shop/[category]">): Promise<Metadata> {
  const { category } = await params;
  return { title: (await getStoreCategories()).find((c) => c.slug === category)?.name };
}

/**
 * The slug is read inside <Suspense>: every category shares one App Shell and
 * the content streams in (then Next caches each URL after its first visit).
 *
 * No generateStaticParams on purpose. In Next 16.4, pre-built params plus an
 * `updateTag("categories")` from the admin made the next client navigation
 * receive a partial App Shell stream that the router rejects (React #412,
 * "This page couldn't load"). Covered by e2e/store-menu.mjs after categories.mjs.
 */
export default function CategoryPage({ params }: PageProps<"/shop/[category]">) {
  return (
    <div className="mx-auto max-w-site px-4 pt-24 pb-16 lg:px-12 lg:pt-36">
      <Suspense fallback={<CategorySkeleton />}>
        <CategoryContent params={params} />
      </Suspense>
    </div>
  );
}

async function CategoryContent({ params }: { params: PageProps<"/shop/[category]">["params"] }) {
  const { category } = await params;
  const categories = await getStoreCategories();
  const at = categories.findIndex((c) => c.slug === category);
  if (at < 0) notFound();
  const cat = categories[at];
  // "More collections": the next two in the store's order (wrapping round), each as a row of up to 10.
  const others = [1, 2].map((n) => categories[(at + n) % categories.length]).filter((c, i, a) => c.slug !== cat.slug && a.indexOf(c) === i);
  const [{ products, hasMore }, counts, rows] = await Promise.all([
    getCategoryProductsPage(cat.slug),
    getProductCounts(),
    Promise.all(others.map(async (c) => ({ ...c, products: await getCollectionRowProducts(c.slug) }))),
  ]);
  const total = counts[cat.slug] ?? products.length;

  return (
    <>
      <Reveal className="mb-8 text-center lg:mb-12">
        <p className="eyebrow">Collection</p>
        <h1 className="mt-3 font-serif text-5xl font-light text-ivory lg:text-6xl">{cat.name}</h1>
        <p className="mt-3 text-sm text-stone">{cat.blurb}</p>
        <div className="hairline mx-auto mt-6 w-24" />
      </Reveal>

      {products.length === 0 ? (
        <Reveal className="mx-auto max-w-md rounded-xl border border-dashed border-gold-500/25 py-14 text-center">
          <p className="font-serif text-2xl text-ivory">New pieces arriving soon</p>
          <p className="mt-2 text-sm text-stone">This collection is being curated. Check back shortly.</p>
        </Reveal>
      ) : (
        <>
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-mute">
            {total} {total === 1 ? "piece" : "pieces"}
          </p>
          <CategoryGrid key={cat.slug} slug={cat.slug} initial={products} initialHasMore={hasMore} />
        </>
      )}

      {rows.some((r) => r.products.length > 0) && (
        <div className="-mx-4 mt-10 lg:-mx-12 lg:mt-16">
          {rows
            .filter((r) => r.products.length > 0)
            .map((r) => (
              <CollectionRow key={r.slug} name={r.name} slug={r.slug} products={r.products} />
            ))}
        </div>
      )}
    </>
  );
}
