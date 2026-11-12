import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Gift } from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/ui/button";
import { getStoreOffers } from "@/lib/data/offers";
import { formatPrice } from "@/lib/format";
import { describeOffer } from "@/lib/validation/offer";

/** Navigations here must show the page at once; `next dev` reports anything that blocks. */
export const instant = true;

export const metadata: Metadata = {
  title: "Offers",
  description: "Combo offers: choose your pieces and pay one special price.",
};

/** All live combo offers (Admin → Offers). Hero banners can link here with the "All offers" button choice. */
export default async function OffersPage() {
  const offers = await getStoreOffers();

  return (
    <div className="mx-auto max-w-site px-4 pt-20 pb-12 lg:px-12 lg:pt-32">
      <Reveal>
        <p className="flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.24em] text-gold-400">
          <Gift className="size-3.5" strokeWidth={1.5} /> Offers
        </p>
        <h1 className="mt-2 font-serif text-4xl font-light text-ivory lg:text-5xl">
          Special <span className="text-gold-300 italic">offers</span>
        </h1>
        <p className="mt-2 text-sm text-stone">Choose your pieces and pay one price for all of them.</p>
      </Reveal>

      {offers.length === 0 ? (
        <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
          <p className="font-serif text-2xl text-ivory">No offers right now</p>
          <p className="mt-2 text-sm text-stone">Check back soon.</p>
          <ButtonLink href="/shop" className="mt-8">
            Explore the collection
          </ButtonLink>
        </div>
      ) : (
        <RevealGroup className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:mt-10 lg:grid-cols-4 lg:gap-5">
          {offers.map((o) => (
            <RevealItem key={o.id}>
              <Link
                href={`/offers/${o.slug}`}
                prefetch
                className="group block overflow-hidden rounded-2xl border border-gold-500/25 bg-ink-850 transition-colors duration-500 hover:border-gold-400/60"
                data-testid="offer-card"
              >
                <span className="relative block aspect-4/5 overflow-hidden bg-ink-950">
                  <Image
                    src={o.coverUrl}
                    alt={o.title}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover transition-transform duration-1000 ease-luxe group-hover:scale-105"
                  />
                  <span className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-ink-950/95 via-ink-950/50 to-transparent" />
                  <span className="bg-gold absolute top-2.5 left-2.5 rounded-full px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-ink-950">
                    {formatPrice(o.price)}
                  </span>
                  <span className="absolute inset-x-0 bottom-0 p-3 lg:p-3.5">
                    <span className="line-clamp-2 font-serif text-lg leading-tight text-ivory lg:text-xl">{o.title}</span>
                    <span className="mt-1 block text-[0.62rem] uppercase tracking-[0.16em] text-gold-300">{describeOffer(o)}</span>
                  </span>
                </span>
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>
      )}
    </div>
  );
}
