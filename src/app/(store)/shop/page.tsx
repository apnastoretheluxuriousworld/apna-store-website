import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CategoryIcon } from "@/components/brand/category-icon";
import { CollectionRow } from "@/components/product/collection-row";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { getHomeCollectionSlugs, getStoreCategories } from "@/lib/data/categories";
import { getCollectionRowProducts, getProductCounts } from "@/lib/data/products";

export const metadata: Metadata = { title: "The Boutique" };

export default async function ShopPage() {
  const [categories, counts, homeSlugs] = await Promise.all([getStoreCategories(), getProductCounts(), getHomeCollectionSlugs()]);
  // Three collections as sideways-scrolling rows under the tiles: the ones picked for the homepage
  // (Admin → Categories), topped up with the first collections that have products.
  const picked = [
    ...categories.filter((c) => homeSlugs.includes(c.slug)),
    ...categories.filter((c) => !homeSlugs.includes(c.slug) && (counts[c.slug] ?? 0) > 0),
  ].slice(0, 3);
  const rows = (await Promise.all(picked.map(async (c) => ({ ...c, products: await getCollectionRowProducts(c.slug) })))).filter(
    (r) => r.products.length > 0,
  );
  return (
    <div className="mx-auto max-w-site px-4 pt-24 pb-16 lg:px-12 lg:pt-36">
      <Reveal className="mb-8 text-center lg:mb-12">
        <p className="eyebrow">Collections</p>
        <h1 className="mt-3 font-serif text-5xl font-light text-ivory lg:text-6xl">
          The <em className="text-gold">Boutique</em>
        </h1>
      </Reveal>

      <RevealGroup className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4 xl:grid-cols-6">
        {categories.map((c) => {
          const cover = c.imageUrl;
          return (
            <RevealItem key={c.slug}>
              <Link
                href={`/shop/${c.slug}`}
                className="group relative block aspect-4/5 overflow-hidden rounded-xl border border-gold-500/10 bg-ink-800"
              >
                {cover ? (
                  <Image
                    src={cover}
                    alt={c.name}
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-cover opacity-85 transition-transform duration-1000 ease-luxe group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_50%_45%,rgba(212,175,55,0.2),transparent_65%)]">
                    <CategoryIcon slug={c.slug} className="size-16 text-gold-400/80" strokeWidth={0.75} />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink-950 via-ink-950/70 to-transparent p-4 pt-12">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-serif text-2xl text-ivory lg:text-3xl">{c.name}</h2>
                    <ArrowUpRight
                      className="size-5 text-gold-400 transition-transform duration-500 group-hover:rotate-45"
                      strokeWidth={1}
                    />
                  </div>
                </div>
              </Link>
            </RevealItem>
          );
        })}
      </RevealGroup>

      {rows.length > 0 && (
        <div className="-mx-4 mt-10 lg:-mx-12 lg:mt-16">
          {rows.map((r) => (
            <CollectionRow key={r.slug} name={r.name} slug={r.slug} products={r.products} />
          ))}
        </div>
      )}
    </div>
  );
}
