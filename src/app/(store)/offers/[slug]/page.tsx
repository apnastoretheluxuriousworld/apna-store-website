import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight, Gift } from "lucide-react";
import { OfferPicker } from "@/components/offers/offer-picker";
import { getStoreOffer } from "@/lib/data/offers";
import { formatPrice } from "@/lib/format";
import { describeOffer } from "@/lib/validation/offer";
import { OfferSkeleton } from "@/components/ui/skeleton";

/** Navigations here must show the page at once; `next dev` reports anything that blocks. */
export const instant = true;

type Params = PageProps<"/offers/[slug]">["params"];

export async function generateMetadata({ params }: PageProps<"/offers/[slug]">): Promise<Metadata> {
  const o = await getStoreOffer((await params).slug);
  if (!o) return { title: "Offer not found" };
  const line = describeOffer(o);
  return {
    title: o.title,
    description: o.description || line,
    openGraph: { title: o.title, description: o.description || line, images: [o.coverUrl] },
  };
}

/** Params are read inside <Suspense>, like the product page. */
export default function OfferPage({ params }: PageProps<"/offers/[slug]">) {
  return (
    <div className="pt-16 pb-12 lg:pt-28">
      <Suspense fallback={<OfferSkeleton />}>
        <OfferContent params={params} />
      </Suspense>
    </div>
  );
}

async function OfferContent({ params }: { params: Params }) {
  const { slug } = await params;
  const offer = await getStoreOffer(slug);
  if (!offer) notFound();
  const fixed = offer.products.length === offer.pickCount;

  return (
    <div className="mx-auto max-w-site lg:px-12">
      <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 pb-5 text-[0.7rem] tracking-wider text-mute uppercase lg:flex">
        <Link href="/" className="hover:text-gold-400">
          Home
        </Link>
        <ChevronRight className="size-3" />
        <Link href="/offers" className="hover:text-gold-400">
          Offers
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-stone">{offer.title}</span>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-12">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <div className="relative aspect-4/5 max-h-[70svh] w-full overflow-hidden bg-ink-950 sm:mx-auto sm:max-w-md sm:rounded-2xl sm:border sm:border-gold-500/20 lg:max-h-none lg:max-w-none">
            <Image src={offer.coverUrl} alt={offer.title} fill priority sizes="(min-width: 1024px) 416px, (min-width: 640px) 448px, 100vw" className="object-cover" />
          </div>
        </div>

        <div className="px-4 lg:px-0">
          <p className="flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.24em] text-gold-400">
            <Gift className="size-3.5" strokeWidth={1.5} /> Offer
          </p>
          <h1 className="mt-2 font-serif text-4xl leading-tight font-light text-ivory lg:text-5xl">{offer.title}</h1>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-serif text-3xl text-gold-300 tabular-nums">{formatPrice(offer.price)}</span>
            <span className="text-sm text-stone">
              {fixed ? `for all ${offer.pickCount}` : `for any ${offer.pickCount} of ${offer.products.length}`}
            </span>
          </p>
          {offer.description && <p className="mt-4 max-w-prose text-sm leading-relaxed whitespace-pre-line text-stone">{offer.description}</p>}

          <OfferPicker
            offer={{ id: offer.id, slug: offer.slug, title: offer.title, pickCount: offer.pickCount, price: offer.price }}
            products={offer.products}
          />

          <p className="mt-8 text-xs leading-relaxed text-mute">
            The offer price applies only when bought through this offer. Coupons can&apos;t be used on offers.
          </p>
        </div>
      </div>
    </div>
  );
}
