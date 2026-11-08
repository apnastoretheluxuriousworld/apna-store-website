"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { ProductCard } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import type { StoreProduct } from "@/lib/data/products";

/** Collection grid: the first page comes from the server, "Load more" fetches the next until none are left. */
export function CategoryGrid({
  slug,
  initial,
  initialHasMore,
}: {
  slug: string;
  initial: StoreProduct[];
  initialHasMore: boolean;
}) {
  const [products, setProducts] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/shop/${slug}?offset=${products.length}`);
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as { products: StoreProduct[]; hasMore: boolean };
      // Skip any already shown (a product added meanwhile shifts the pages by one).
      setProducts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.products.filter((p) => !seen.has(p.id))];
      });
      setHasMore(page.hasMore);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <RevealGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4 xl:grid-cols-6">
        {products.map((p) => (
          <RevealItem key={p.id}>
            <ProductCard product={p} />
          </RevealItem>
        ))}
      </RevealGroup>

      {hasMore && (
        <div className="mt-8 flex flex-col items-center gap-2">
          <Button variant="outline" size="lg" onClick={loadMore} disabled={loading} className="min-w-48">
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Load more"}
          </Button>
          {failed && <p className="text-xs text-red-300">Couldn&apos;t load more. Please try again.</p>}
        </div>
      )}
    </>
  );
}
