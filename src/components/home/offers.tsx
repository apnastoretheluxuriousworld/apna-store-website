import Image from "next/image";
import Link from "next/link";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { SectionHeader } from "@/components/ui/section-header";
import { getStoreOffers } from "@/lib/data/offers";
import { formatPrice } from "@/lib/format";
import { describeOffer } from "@/lib/validation/offer";
import { cn } from "@/lib/utils";

/**
 * Homepage "Offers", right under Our Feed: combo deals from Admin → Offers,
 * each card opening its page where the customer picks the items. Hidden when
 * there are none.
 */
export async function Offers() {
  const offers = await getStoreOffers();
  if (!offers.length) return null;
  const single = offers.length === 1;

  return (
    <section className="mx-auto max-w-site px-4 py-6 lg:px-12 lg:py-12" aria-labelledby="offers-heading">
      <Reveal>
        <SectionHeader title="Offers" id="offers-heading" />
      </Reveal>
      <RevealGroup className={cn("-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-none lg:mx-0 lg:gap-5 lg:px-0", single && "lg:max-w-md")}>
        {offers.map((o) => (
          <RevealItem key={o.id} className={cn("shrink-0 snap-start", single ? "w-[78%] sm:w-72 lg:w-full" : "w-[62%] sm:w-64 lg:w-72")}>
            <Link
              href={`/offers/${o.slug}`}
              className="group block overflow-hidden rounded-2xl border border-gold-500/25 bg-ink-850 transition-colors duration-500 hover:border-gold-400/60"
              data-testid="offer-card"
            >
              <span className="relative block aspect-4/5 overflow-hidden bg-ink-950">
                <Image
                  src={o.coverUrl}
                  alt={o.title}
                  fill
                  sizes="(min-width: 1024px) 288px, (min-width: 640px) 256px, 62vw"
                  className="object-cover transition-transform duration-1000 ease-luxe group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-ink-950/95 via-ink-950/50 to-transparent" />
                <span className="bg-gold absolute top-3 left-3 rounded-full px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-ink-950">
                  {formatPrice(o.price)}
                </span>
                <span className="absolute inset-x-0 bottom-0 p-3.5">
                  <span className="line-clamp-2 font-serif text-xl leading-tight text-ivory">{o.title}</span>
                  <span className="mt-1 block text-[0.68rem] uppercase tracking-[0.18em] text-gold-300">
                    {describeOffer(o)} <span aria-hidden>→</span>
                  </span>
                </span>
              </span>
            </Link>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
