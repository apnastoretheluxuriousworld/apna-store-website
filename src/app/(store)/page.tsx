import Image from "next/image";
import Link from "next/link";
import { Feed } from "@/components/home/feed";
import { Hero } from "@/components/home/hero";
import { Testimonials } from "@/components/home/testimonials";
import { SectionHeader } from "@/components/ui/section-header";
import { CollectionRow } from "@/components/product/collection-row";
import { ProductCard } from "@/components/product/product-card";
import { CategoryIcon } from "@/components/brand/category-icon";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { getHomeCollectionSlugs, getStoreCategories } from "@/lib/data/categories";
import { getHeroSlides } from "@/lib/data/hero";
import { getCollectionRowProducts, getFeaturedProducts } from "@/lib/data/products";

/** Navigations here must show the page at once; `next dev` reports anything that blocks. */
export const instant = true;

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

      {/* 3. Collections */}
      <section className="mx-auto max-w-site px-4 py-6 lg:px-12 lg:py-12">
        <Reveal>
          <SectionHeader title="Explore Collections" href="/shop" />
        </Reveal>
        {/* Small landscape cards: 2 per row on phones (3 rows = 6 on screen), 3 on tablets, 6 on desktop. */}
        <RevealGroup className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
          {categories.map((c) => (
            <RevealItem key={c.slug}>
              <Link
                href={`/shop/${c.slug}`}
                prefetch
                className="group relative grid aspect-16/10 place-items-center overflow-hidden rounded-lg border border-gold-500/25 bg-ink-800/70 transition-all duration-500 hover:border-gold-400/70 hover:shadow-[0_0_30px_-6px_rgba(212,175,55,0.5)] active:scale-[0.97] lg:aspect-4/5 lg:rounded-xl"
              >
                {c.imageUrl ? (
                  <Image
                    src={c.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <CategoryIcon
                    slug={c.slug}
                    className="-mt-4 size-7 text-gold-400 transition-transform duration-500 group-hover:scale-110 lg:size-9"
                    strokeWidth={1}
                  />
                )}
                <span className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-ink-950/90 via-ink-950/50 to-transparent px-2 pt-6 pb-1.5 text-center text-[0.7rem] font-medium uppercase tracking-[0.14em] text-ivory group-hover:text-gold-300 lg:pb-2.5 lg:text-xs">
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
          <RevealGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4 xl:grid-cols-6">
            {bestSellers.map((p) => (
              <RevealItem key={p.id}>
                <ProductCard product={p} />
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}

      {/* 5. Homepage collections (Admin → Categories, up to 3) — small cards, horizontal scroll */}
      {topCollections.map((c) => (
        <CollectionRow key={c.slug} name={c.name} slug={c.slug} products={c.products} />
      ))}

      {/* 6. Testimonials (Admin → Testimonials) */}
      <Testimonials />
    </>
  );
}
