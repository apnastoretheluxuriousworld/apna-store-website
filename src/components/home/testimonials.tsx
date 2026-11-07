import { Quote } from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { Stars } from "@/components/reviews/stars";
import { getStoreTestimonials } from "@/lib/data/testimonials";
import { TestimonialMedia } from "./testimonial-media";

/**
 * Homepage "Loved by connoisseurs". Managed in Admin → Testimonials (cached
 * with the "testimonials" tag; admin actions refresh it). Hidden when empty.
 */
export async function Testimonials() {
  const items = await getStoreTestimonials();
  if (!items.length) return null;

  return (
    <section className="border-t border-ink-600/50 bg-ink-950 py-14 lg:py-24">
      <div className="mx-auto max-w-site px-4 lg:px-12">
        <Reveal className="mb-10 text-center">
          <p className="eyebrow">Testimonials</p>
          <h2 className="mt-3 font-serif text-4xl font-light text-ivory lg:text-5xl">
            Loved by <em className="text-gold">connoisseurs</em>
          </h2>
        </Reveal>
        {/* Mobile: swipe carousel. Desktop: masonry columns, so tall video cards don't leave gaps. */}
        <RevealGroup className="-mx-4 flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-4 pb-2 scrollbar-none lg:mx-0 lg:block lg:columns-3 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0">
          {items.map((t) => (
            <RevealItem
              key={t.id}
              className="flex w-[82%] shrink-0 snap-center flex-col rounded-xl border border-gold-500/10 bg-ink-800/70 p-6 sm:w-[60%] lg:mb-5 lg:w-auto lg:break-inside-avoid"
            >
              {t.media ? (
                <TestimonialMedia media={t.media} name={t.name} />
              ) : (
                <Quote className="size-6 text-gold-500/70" strokeWidth={1} />
              )}
              {t.body && <p className="mt-4 font-serif text-xl leading-snug whitespace-pre-line text-ivory/90">{t.body}</p>}
              <div className="mt-6 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ivory">{t.name}</p>
                  {t.city && <p className="truncate text-xs text-stone">{t.city}</p>}
                </div>
                <Stars rating={t.rating} size="size-3" />
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
