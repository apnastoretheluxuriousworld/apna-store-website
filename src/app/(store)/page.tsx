import Link from "next/link";
import { Feed } from "@/components/home/feed";
import { Hero } from "@/components/home/hero";
import { Testimonials } from "@/components/home/testimonials";
import { SectionHeader } from "@/components/ui/section-header";
import { ProductCard } from "@/components/product/product-card";
import { CategoryIcon } from "@/components/brand/category-icon";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { getStoreCategories } from "@/lib/data/categories";
import { getFeaturedProducts } from "@/lib/data/products";

export default async function HomePage() {
  const [categories, bestSellers] = await Promise.all([
    getStoreCategories(),
    getFeaturedProducts(),
  ]);
  return (
    <>
      {/* 1. Hero carousel (admin-managed in F7) */}
      <Hero />

      {/* 2. Our Feed — vertical 9:16 videos (Admin → Feed) */}
      <Feed />

      {/* 3. Collections */}
      <section className="mx-auto max-w-site px-4 py-6 lg:px-12 lg:py-12">
        <Reveal>
          <SectionHeader title="Explore Collections" href="/shop" />
        </Reveal>
        <RevealGroup className="-mx-4 flex gap-5 overflow-x-auto px-4 pb-2 scrollbar-none sm:justify-between lg:mx-0 lg:px-0">
          {categories.map((c) => (
            <RevealItem key={c.slug} className="shrink-0">
              <Link
                href={`/shop/${c.slug}`}
                className="group flex w-16 flex-col items-center gap-2 lg:w-32"
              >
                <span className="grid size-16 place-items-center rounded-full border border-gold-500/50 bg-ink-800/60 transition-all duration-500 group-hover:border-gold-300 group-hover:shadow-[0_0_30px_-6px_rgba(212,175,55,0.6)] lg:size-28">
                  <CategoryIcon
                    slug={c.slug}
                    className="size-6 text-gold-400 transition-transform duration-500 group-hover:scale-110 lg:size-9"
                    strokeWidth={1}
                  />
                </span>
                <span className="text-center text-[0.7rem] text-ivory/80 group-hover:text-gold-300 lg:text-sm">
                  {c.name}
                </span>
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* 4. Best sellers (products marked Featured in admin) */}
      {bestSellers.length > 0 && (
        <section className="mx-auto max-w-site px-4 py-12 lg:px-12 lg:py-20">
          <Reveal>
            <SectionHeader title="Best Sellers" href="/shop" />
          </Reveal>
          <RevealGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {bestSellers.map((p) => (
              <RevealItem key={p.id}>
                <ProductCard product={p} />
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}

      {/* 5. Testimonials (Admin → Testimonials) */}
      <Testimonials />
    </>
  );
}
