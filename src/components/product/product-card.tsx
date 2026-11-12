import Image from "next/image";
import { IntentLink } from "@/components/ui/intent-link";
import { Star } from "lucide-react";
import { CategoryIcon } from "@/components/brand/category-icon";
import { AddToBag } from "@/components/cart/add-to-bag";
import { formatPrice } from "@/lib/format";
import type { StoreProduct } from "@/lib/data/products";

/** Product tile, styled after the brand reference (dark card, gold accents). */
export function ProductCard({ product }: { product: StoreProduct }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-gold-500/10 bg-ink-800/70 transition-colors duration-500 hover:border-gold-500/30">
      <IntentLink
        href={`/shop/${product.categorySlug}/${product.slug}`}
        className="relative block aspect-6/5 overflow-hidden bg-ink-950 transition-opacity active:opacity-75 sm:aspect-square"
        aria-label={product.name}
      >
        {product.image ? (
          <>
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-1000 ease-luxe group-hover:scale-105"
            />
            <div className="absolute inset-x-0 bottom-0 h-1/4 bg-linear-to-t from-ink-800/80 to-transparent" />
          </>
        ) : (
          <>
            {/* Placeholder until this category's photos arrive */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,rgba(212,175,55,0.22),transparent_60%)] transition-transform duration-700 ease-luxe group-hover:scale-110" />
            <div className="absolute inset-x-6 bottom-8 h-6 rounded-[50%] bg-black/60 blur-md" />
            <div className="absolute inset-0 grid place-items-center">
              <CategoryIcon
                slug={product.categorySlug}
                className="size-16 text-gold-400/80 drop-shadow-[0_0_24px_rgba(212,175,55,0.45)] transition-transform duration-700 ease-luxe group-hover:-translate-y-1 group-hover:scale-105"
                strokeWidth={0.75}
              />
            </div>
          </>
        )}
      </IntentLink>

      <div className="flex flex-1 flex-col p-2.5 lg:p-3">
        <h3 className="truncate text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-gold-400 lg:text-xs">
          <IntentLink href={`/shop/${product.categorySlug}/${product.slug}`} className="hover:text-gold-300">
            {product.name}
          </IntentLink>
        </h3>
        {product.subtitle && <p className="mt-0.5 hidden truncate text-[0.7rem] text-stone sm:block">{product.subtitle}</p>}
        <p className="mt-1 flex items-baseline gap-2 text-sm font-medium text-ivory">
          {formatPrice(product.price)}
          {product.compareAtPrice != null && product.compareAtPrice > product.price && (
            <s className="text-[0.7rem] font-normal text-mute">{formatPrice(product.compareAtPrice)}</s>
          )}
        </p>
        {product.rating != null && (
          <div className="mt-1 flex items-center gap-1 text-[0.65rem] text-stone">
            <div className="flex text-gold-400" aria-label={`Rated ${product.rating} out of 5`}>
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className="size-2.5"
                  fill={i < Math.round(product.rating ?? 0) ? "currentColor" : "none"}
                  strokeWidth={1.5}
                />
              ))}
            </div>
            <span>
              {product.rating} ({product.reviewCount})
            </span>
          </div>
        )}
        <div className="mt-auto pt-2.5 lg:pt-3">
          <AddToBag product={product} />
        </div>
      </div>
    </article>
  );
}
