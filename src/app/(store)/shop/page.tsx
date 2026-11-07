import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CategoryIcon } from "@/components/brand/category-icon";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { getStoreCategories } from "@/lib/data/categories";
import { demoCover, demoProductsIn } from "@/lib/demo";

export const metadata: Metadata = { title: "The Boutique" };

// DEMO: collections overview. F6 replaces this with database categories.
export default async function ShopPage() {
  const categories = await getStoreCategories();
  return (
    <div className="mx-auto max-w-site px-4 pt-24 pb-16 lg:px-12 lg:pt-36">
      <Reveal className="mb-8 text-center lg:mb-12">
        <p className="eyebrow">Collections</p>
        <h1 className="mt-3 font-serif text-5xl font-light text-ivory lg:text-6xl">
          The <em className="text-gold">Boutique</em>
        </h1>
      </Reveal>

      <RevealGroup className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
        {categories.map((c) => {
          const cover = c.imageUrl || demoCover(c.slug);
          const count = demoProductsIn(c.slug).length;
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
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <h2 className="font-serif text-2xl text-ivory lg:text-3xl">{c.name}</h2>
                      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-gold-400">
                        {count} pieces
                      </p>
                    </div>
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
    </div>
  );
}
