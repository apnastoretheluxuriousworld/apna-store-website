import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight, PackageCheck, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { ProductCard } from "@/components/product/product-card";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductPurchase } from "@/components/product/product-purchase";
import { ProductReviews } from "@/components/reviews/product-reviews";
import { Stars } from "@/components/reviews/stars";
import { SectionHeader } from "@/components/ui/section-header";
import { getRelatedProducts, getStoreProductDetail } from "@/lib/data/products";
import { getStoreInfo } from "@/lib/data/settings";
import { site } from "@/lib/site";
import { ProductDetailSkeleton } from "@/components/ui/skeleton";

/** Navigations here must show the page at once; `next dev` reports anything that blocks. */
export const instant = true;

type Params = PageProps<"/shop/[category]/[product]">["params"];

export async function generateMetadata({ params }: PageProps<"/shop/[category]/[product]">): Promise<Metadata> {
  const p = await getStoreProductDetail((await params).product);
  if (!p) return { title: "Not found" };
  const image = p.media.find((m) => m.type === "image")?.url ?? p.image;
  return {
    title: p.name,
    description: p.subtitle || `${p.name} — ${p.categoryName} at ${site.name}.`,
    openGraph: { title: p.name, description: p.subtitle || undefined, images: image ? [image] : undefined },
  };
}

const promises = [
  { Icon: Truck, text: "Delivery across India" },
  { Icon: ShieldCheck, text: "Secure checkout" },
  { Icon: PackageCheck, text: "Inspected & packed with care" },
  { Icon: RotateCcw, text: "Damaged on arrival? Replacement or refund", href: "/terms" },
];

/** Params are read inside <Suspense> (same reason as the category page — see its comment). */
export default function ProductPage({ params }: PageProps<"/shop/[category]/[product]">) {
  return (
    <div className="pt-16 pb-12 lg:pt-28">
      <Suspense fallback={<ProductDetailSkeleton />}>
        <ProductContent params={params} />
      </Suspense>
    </div>
  );
}

async function ProductContent({ params }: { params: Params }) {
  const { category, product: slug } = await params;
  const [product, info] = await Promise.all([getStoreProductDetail(slug), getStoreInfo()]);
  if (!product) notFound();
  // Moved to another collection since the link was shared → send to its current address.
  if (product.categorySlug !== category) permanentRedirect(`/shop/${product.categorySlug}/${product.slug}`);
  const related = await getRelatedProducts(product.categorySlug, product.id);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    sku: product.sku || undefined,
    image: product.media.filter((m) => m.type === "image").map((m) => m.url),
    category: product.categoryName,
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: product.price,
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(product.rating != null && product.reviewCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviewCount } }
      : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="mx-auto max-w-site lg:px-12">
        <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 pb-5 text-[0.7rem] tracking-wider text-mute uppercase lg:flex">
          <Link href="/shop" className="hover:text-gold-300">Shop</Link>
          <ChevronRight className="size-3" />
          <Link href={`/shop/${product.categorySlug}`} className="hover:text-gold-300">{product.categoryName}</Link>
          <ChevronRight className="size-3" />
          <span className="truncate text-stone">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <ProductGallery media={product.media} name={product.name} categorySlug={product.categorySlug} />
          </div>

          <div className="px-4 lg:px-0 lg:pt-2">
            <Link href={`/shop/${product.categorySlug}`} className="eyebrow hover:text-gold-300">
              {product.categoryName}
            </Link>
            <h1 className="mt-2 font-serif text-3xl leading-tight font-light text-ivory lg:text-5xl">{product.name}</h1>
            {product.rating != null && product.reviewCount > 0 && (
              <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-xs text-stone hover:text-gold-300">
                <Stars rating={product.rating} size="size-3" />
                {product.rating.toFixed(1)} · {product.reviewCount} {product.reviewCount === 1 ? "review" : "reviews"}
              </a>
            )}

            <div className="mt-5">
              <ProductPurchase product={product} whatsappUrl={info.whatsappUrl} />
            </div>

            <ul className="mt-6 grid grid-cols-2 gap-2">
              {promises.map(({ Icon, text, href }) => {
                const body = (
                  <>
                    <Icon className="size-4 shrink-0 text-gold-400" strokeWidth={1.25} />
                    <span>{text}</span>
                  </>
                );
                return (
                  <li key={text}>
                    {href ? (
                      <Link href={href} className="flex h-full items-start gap-2 rounded-lg border border-ink-600/60 p-3 text-[0.7rem] leading-snug text-stone hover:border-gold-500/40 hover:text-gold-300">
                        {body}
                      </Link>
                    ) : (
                      <span className="flex h-full items-start gap-2 rounded-lg border border-ink-600/60 p-3 text-[0.7rem] leading-snug text-stone">{body}</span>
                    )}
                  </li>
                );
              })}
            </ul>

            {product.description && (
              <section className="mt-8 border-t border-ink-600/50 pt-6">
                <h2 className="mb-3 text-[0.65rem] uppercase tracking-[0.25em] text-gold-500">Description</h2>
                <p className="text-sm leading-relaxed whitespace-pre-line text-stone">{product.description}</p>
              </section>
            )}

            {(product.specs.length > 0 || product.sku) && (
              <section className="mt-8 border-t border-ink-600/50 pt-6">
                <h2 className="mb-3 text-[0.65rem] uppercase tracking-[0.25em] text-gold-500">Details</h2>
                <dl className="divide-y divide-ink-600/40 text-sm">
                  {product.specs.map((s) => (
                    <div key={s.label} className="flex justify-between gap-6 py-2.5">
                      <dt className="text-mute">{s.label}</dt>
                      <dd className="text-right text-ivory">{s.value}</dd>
                    </div>
                  ))}
                  {product.sku && (
                    <div className="flex justify-between gap-6 py-2.5">
                      <dt className="text-mute">SKU</dt>
                      <dd className="text-right text-stone tabular-nums">{product.sku}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-site px-4 lg:mt-10 lg:px-12">
        <Suspense fallback={null}>
          <ProductReviews productId={product.id} />
        </Suspense>
      </div>

      {related.length > 0 && (
        <section className="mx-auto max-w-site border-t border-ink-600/50 pt-10 lg:px-12 lg:pt-14">
          <Reveal className="px-4 lg:px-0">
            <SectionHeader title="You may also like" href={`/shop/${product.categorySlug}`} />
          </Reveal>
          <RevealGroup className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 scrollbar-none lg:scroll-px-0 lg:gap-5 lg:px-0">
            {related.map((p) => (
              <RevealItem key={p.id} className="w-36 shrink-0 snap-start sm:w-44 lg:w-56">
                <ProductCard product={p} />
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}
    </>
  );
}
