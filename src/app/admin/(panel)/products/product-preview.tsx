"use client";

import { useWatch } from "react-hook-form";
import { Heart } from "lucide-react";
import { CategoryIcon } from "@/components/brand/category-icon";
import { buttonClass } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { coverOf } from "@/lib/media";
import { totalStock } from "@/lib/validation/product";
import { cn } from "@/lib/utils";
import type { Control } from "react-hook-form";
import type { ProductOutput } from "@/lib/validation/product";
import type { ProductFormValues } from "./product-form";

/**
 * Live look at the product tile customers will see in the store, updated as
 * the admin types. Same look as the store's ProductCard, but nothing is
 * clickable (no links, no bag).
 */
export function ProductPreview({
  control,
  categoryName,
}: {
  control: Control<ProductFormValues, unknown, ProductOutput>;
  categoryName?: string;
}) {
  const [name, description, price, compareAtPrice, images, trackStock, stock, variants, status] = useWatch({
    control,
    name: ["name", "description", "price", "compareAtPrice", "images", "trackStock", "stock", "variants", "status"],
  });

  const title = name.trim() || "Product name";
  const subtitle = (description ?? "").split("\n")[0].trim();
  const image = coverOf(images ?? [])?.url ?? null;
  const hasPrice = Number.isFinite(price);
  const hasCompare = compareAtPrice != null && Number.isFinite(compareAtPrice) && hasPrice && compareAtPrice > price;
  const safeVariants = (variants ?? []).map((v) => ({ stock: Number.isFinite(v.stock) ? v.stock : 0 }));
  const inStock = !trackStock || totalStock(Number.isFinite(stock) ? stock : 0, safeVariants) > 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Store preview</h2>
        {status !== "active" && (
          <span className="rounded-full border border-ink-600 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.16em] text-mute">
            Draft · hidden
          </span>
        )}
      </div>

      <article
        aria-label="Preview of the product card in the store"
        className="relative mx-auto flex max-w-60 flex-col overflow-hidden rounded-xl border border-gold-500/10 bg-ink-800/70"
      >
        <div className="relative aspect-4/5 overflow-hidden bg-ink-950">
          {image ? (
            <>
              {/* Plain <img>: pasted URLs may not be on next/image's allow list */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 h-1/4 bg-linear-to-t from-ink-800/80 to-transparent" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,rgba(212,175,55,0.22),transparent_60%)]" />
              <div className="absolute inset-x-6 bottom-8 h-6 rounded-[50%] bg-black/60 blur-md" />
              <div className="absolute inset-0 grid place-items-center">
                <CategoryIcon
                  slug={(categoryName ?? "").toLowerCase()}
                  className="size-16 text-gold-400/80 drop-shadow-[0_0_24px_rgba(212,175,55,0.45)]"
                  strokeWidth={0.75}
                />
              </div>
            </>
          )}
        </div>

        <span className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-ink-950/60 text-ivory/70 backdrop-blur">
          <Heart className="size-4" strokeWidth={1.5} />
        </span>

        <div className="flex flex-1 flex-col p-3 lg:p-4">
          <h3 className="truncate text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-gold-400 lg:text-xs">{title}</h3>
          {subtitle && <p className="mt-0.5 truncate text-[0.7rem] text-stone">{subtitle}</p>}
          <p className="mt-1.5 flex items-baseline gap-2 text-sm font-medium text-ivory">
            {hasPrice ? formatPrice(price) : <span className="text-mute">₹ —</span>}
            {hasCompare && <s className="text-[0.7rem] font-normal text-mute">{formatPrice(compareAtPrice)}</s>}
          </p>
          <div className="mt-auto pt-3">
            <span aria-hidden className={buttonClass("outline", "sm", cn("pointer-events-none w-full", !inStock && "opacity-50"))}>
              {inStock ? "Add to cart" : "Sold out"}
            </span>
          </div>
        </div>
      </article>
      <p className="mt-3 text-center text-xs text-mute">How it looks in the shop. Updates as you type.</p>
    </div>
  );
}
