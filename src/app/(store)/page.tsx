import Image from "next/image";
import Link from "next/link";
import { Play, Quote, Star } from "lucide-react";
import { Hero } from "@/components/home/hero";
import { SectionHeader } from "@/components/ui/section-header";
import { ProductCard } from "@/components/product/product-card";
import { CategoryIcon } from "@/components/brand/category-icon";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { getStoreCategories } from "@/lib/data/categories";
import { demoBestSellers, demoReels, demoTestimonials } from "@/lib/demo";

export default async function HomePage() {
  const categories = await getStoreCategories();
  return (
    <>
      {/* 1. Hero carousel (admin-managed in F7) */}
      <Hero />

      {/* 2. Reels — client marketing videos (F7) */}
      <section className="py-12 lg:py-20">
        <div className="mx-auto max-w-site px-4 lg:px-12">
          <Reveal>
            <SectionHeader title="The Film Room" href="/shop" linkLabel="Watch all" />
          </Reveal>
        </div>
        <RevealGroup className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-none lg:mx-auto lg:max-w-site lg:gap-5 lg:px-12">
          {demoReels.map(({ title: t, poster }) => (
            <RevealItem
              key={t}
              className="group relative aspect-9/16 w-40 shrink-0 snap-start overflow-hidden rounded-xl border border-gold-500/10 bg-ink-800 sm:w-48 lg:w-56"
            >
              <Image
                src={poster}
                alt=""
                fill
                sizes="(min-width: 1024px) 224px, 160px"
                className="object-cover opacity-80 transition-transform duration-1000 ease-luxe group-hover:scale-105"
              />
              <div className="absolute inset-0 grid place-items-center">
                <span className="grid size-12 place-items-center rounded-full border border-gold-400/60 bg-ink-950/50 backdrop-blur transition-transform duration-500 group-hover:scale-110">
                  <Play className="ml-0.5 size-4 fill-gold-400 text-gold-400" />
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink-950 to-transparent p-3">
                <p className="font-serif text-lg text-ivory">{t}</p>
                <p className="text-[0.6rem] uppercase tracking-[0.2em] text-stone">Video coming soon</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* 3. Collections */}
      <section className="mx-auto max-w-site px-4 py-6 lg:px-12 lg:py-12">
        <Reveal>
          <SectionHeader title="Explore Collections" href="/shop" />
        </Reveal>
        <RevealGroup className="-mx-4 flex gap-5 overflow-x-auto px-4 pb-2 scrollbar-none sm:justify-between lg:mx-0 lg:px-0">
          {categories.map((c) => (
            <RevealItem key={c.slug} className="shrink-0">
              <Link href={`/shop/${c.slug}`} className="group flex w-16 flex-col items-center gap-2 lg:w-32">
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

      {/* 4. Best sellers (featured products) */}
      <section className="mx-auto max-w-site px-4 py-12 lg:px-12 lg:py-20">
        <Reveal>
          <SectionHeader title="Best Sellers" href="/shop" />
        </Reveal>
        <RevealGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-6">
          {demoBestSellers.map((p) => (
            <RevealItem key={p.id}>
              <ProductCard product={p} />
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* 5. Testimonials (images + videos in F7) */}
      <section className="border-t border-ink-600/50 bg-ink-950 py-14 lg:py-24">
        <div className="mx-auto max-w-site px-4 lg:px-12">
          <Reveal className="mb-10 text-center">
            <p className="eyebrow">Testimonials</p>
            <h2 className="mt-3 font-serif text-4xl font-light text-ivory lg:text-5xl">
              Loved by <em className="text-gold">connoisseurs</em>
            </h2>
          </Reveal>
          <RevealGroup className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scrollbar-none lg:mx-0 lg:grid lg:grid-cols-3 lg:px-0">
            {demoTestimonials.map((t) => (
              <RevealItem
                key={t.name}
                className="w-[82%] shrink-0 snap-center rounded-xl border border-gold-500/10 bg-ink-800/70 p-6 sm:w-[60%] lg:w-auto"
              >
                <Quote className="size-6 text-gold-500/70" strokeWidth={1} />
                <p className="mt-4 font-serif text-xl leading-snug text-ivory/90">{t.text}</p>
                <div className="mt-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ivory">{t.name}</p>
                    <p className="text-xs text-stone">{t.city}</p>
                  </div>
                  <div className="flex text-gold-400">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className="size-3" fill="currentColor" />
                    ))}
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>
    </>
  );
}
