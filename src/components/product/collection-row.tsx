import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { ProductCard } from "@/components/product/product-card";
import { SectionHeader } from "@/components/ui/section-header";
import type { StoreProduct } from "@/lib/data/products";

/** A collection as one row of small cards that scrolls sideways, with "View all". */
export function CollectionRow({ name, slug, products }: { name: string; slug: string; products: StoreProduct[] }) {
  return (
    <section className="mx-auto max-w-site py-6 lg:px-12 lg:py-10">
      <Reveal className="px-4 lg:px-0">
        <SectionHeader title={name} href={`/shop/${slug}`} />
      </Reveal>
      <RevealGroup className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 scrollbar-none lg:scroll-px-0 lg:gap-5 lg:px-0">
        {products.map((p) => (
          <RevealItem key={p.id} className="w-36 shrink-0 snap-start sm:w-44 lg:w-56">
            <ProductCard product={p} />
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
