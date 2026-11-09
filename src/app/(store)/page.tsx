import Image from "next/image";
import Link from "next/link";
import { Feed } from "@/components/home/feed";
import { Hero } from "@/components/home/hero";
import { Offers } from "@/components/home/offers";
import { Testimonials } from "@/components/home/testimonials";
import { SectionHeader } from "@/components/ui/section-header";
import { CollectionRow } from "@/components/product/collection-row";
import { ProductCard } from "@/components/product/product-card";
import { CategoryIcon } from "@/components/brand/category-icon";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { getHomeCollectionSlugs, getStoreCategories } from "@/lib/data/categories";
import { getHeroSlides } from "@/lib/data/hero";
import { getCollectionRowProducts, getFeaturedProducts } from "@/lib/data/products";

export default async function HomePage() {
  const [heroSlides, categories, bestSellers, homeSlugs] = await Promise.all([
    getHeroSlides(),
    getStoreCategories(),
    getFeaturedProducts(),
    getHomeCollectionSlugs(),
  ]);
  // Collections picked in Admin → Categories (up to 3), each as a small-card strip after Best Sellers.
  const topCollections = (
    await Promise.all(
      categories
        .filter((c) => homeSlugs.includes(c.slug))
        .map(async (c) => ({ ...c, products: await getCollectionRowProducts(c.slug) })),
    )
  ).filter((c) => c.products.length > 0);
  return (
    <>
      {/* 1. Hero carousel — Admin → Hero banners */}
      <Hero slides={heroSlides} />

      {/* 2. Our Feed — vertical 9:16 videos (Admin → Feed) */}
      <Feed />

      {/* 3. Offers — combo deals (Admin → Offers) */}
      <Offers />

      {/* 4. Collections */}
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
                <span className="relative grid size-16 place-items-center overflow-hidden rounded-full border border-gold-500/50 bg-ink-800/60 transition-all duration-500 group-hover:border-gold-300 group-hover:shadow-[0_0_30px_-6px_rgba(212,175,55,0.6)] lg:size-28">
                  {c.imageUrl ? (
                    <Image
                      src={c.imageUrl}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 112px, 64px"
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <CategoryIcon
                      slug={c.slug}
                      className="size-6 text-gold-400 transition-transform duration-500 group-hover:scale-110 lg:size-9"
                      strokeWidth={1}
                    />
                  )}
                </span>
                <span className="text-center text-[0.7rem] text-ivory/80 group-hover:text-gold-300 lg:text-sm">
                  {c.name}
                </span>
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* 5. Best sellers (products marked Featured in admin) */}
      {bestSellers.length > 0 && (
        <section className="mx-auto max-w-site px-4 py-12 lg:px-12 lg:py-20">
          <Reveal>
            <SectionHeader title="Best Sellers" href="/shop" />
          </Reveal>
          <RevealGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4 xl:grid-cols-6">
            {bestSellers.map((p) => (
              <RevealItem key={p.id}>
                <ProductCard product={p} />
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}

      {/* 6. Homepage collections (Admin → Categories, up to 3) — small cards, horizontal scroll */}
      {topCollections.map((c) => (
        <CollectionRow key={c.slug} name={c.name} slug={c.slug} products={c.products} />
      ))}

      {/* 7. Testimonials (Admin → Testimonials) */}
      <Testimonials />
    </>
  );
}
