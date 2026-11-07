import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { ProductCard } from "@/components/product/product-card";
import { getStoreCategories } from "@/lib/data/categories";
import { demoProductsIn } from "@/lib/demo";

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

// DEMO products: F6 replaces them with database products, filters and sorting.
async function CategoryContent({ params }: { params: PageProps<"/shop/[category]">["params"] }) {
  const { category } = await params;
  const cat = (await getStoreCategories()).find((c) => c.slug === category);
  if (!cat) notFound();
  const products = demoProductsIn(cat.slug);

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
            {products.length} {products.length === 1 ? "piece" : "pieces"}
          </p>
          <RevealGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {products.map((p) => (
              <RevealItem key={p.id}>
                <ProductCard product={p} />
              </RevealItem>
            ))}
          </RevealGroup>
        </>
      )}
    </>
  );
}

function CategorySkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading collection">
      <div className="mx-auto mb-12 flex flex-col items-center gap-3">
        <div className="h-3 w-24 rounded bg-ink-800" />
        <div className="h-12 w-56 rounded bg-ink-800" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-4/5 rounded-xl bg-ink-850" />
        ))}
      </div>
    </div>
  );
}
