"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import type { StoreProduct, StoreVariant } from "@/lib/data/products";
import { MAX_QTY_PER_LINE, lineKey } from "@/lib/validation/checkout";
import { cn } from "@/lib/utils";
import { addToCart, removeFromCart, useCart } from "./cart-store";

const noopSubscribe = () => () => {};

type Props = Pick<StoreProduct, "id" | "name" | "image" | "price" | "inStock" | "stockLeft" | "variants">;

/** "Add to cart" on product cards. Products with sizes/options ask which one first. */
export function AddToBag({ product, className }: { product: Props; className?: string }) {
  const [picking, setPicking] = useState(false);

  // Once this product (any of its options) is in the bag, the same button removes it again.
  const bag = useCart();
  const lines = bag.filter((i) => i.productId === product.id);
  const inBag = lines.length > 0;

  function remove() {
    for (const l of lines) removeFromCart(lineKey(l));
  }

  function add(variant: StoreVariant | null) {
    const max = (variant ? variant.stockLeft : product.stockLeft) ?? MAX_QTY_PER_LINE;
    addToCart({ productId: product.id, variantId: variant?.id ?? null }, 1, max);
    setPicking(false); // added → the button shows "Added"; tapping it again removes (no toasts for the bag)
  }

  if (!product.inStock) {
    return (
      <Button variant="outline" size="sm" className={cn("w-full lg:h-10 lg:px-2 lg:tracking-[0.14em] whitespace-nowrap", className)} disabled>
        Sold out
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("w-full whitespace-nowrap lg:h-10 lg:px-2 lg:tracking-[0.14em]", inBag && "border-gold-400 bg-gold-500/15", className)}
        onClick={() => (inBag ? remove() : product.variants.length ? setPicking(true) : add(null))}
        aria-label={inBag ? `${product.name} is in your cart — tap to remove` : undefined}
        title={inBag ? "In your cart — tap to remove" : undefined}
        aria-haspopup={product.variants.length ? "dialog" : undefined}
      >
        {inBag ? (
          <>
            <Check className="size-3.5" /> Added
          </>
        ) : (
          "Add to cart"
        )}
      </Button>
      <VariantSheet product={product} open={picking} onClose={() => setPicking(false)} onPick={add} />
    </>
  );
}

function VariantSheet({
  product,
  open,
  onClose,
  onPick,
}: {
  product: Props;
  open: boolean;
  onClose: () => void;
  onPick: (v: StoreVariant) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Portals can't be hydrated: render it only once we're in the browser.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-950/70 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          data-lenis-prevent
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Choose an option for ${product.name}`}
            className="w-full max-w-md rounded-t-2xl border border-gold-500/20 bg-ink-850 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-5"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              {product.image && (
                <span className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-ink-600">
                  <Image src={product.image} alt="" fill sizes="56px" className="object-cover" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="eyebrow">Choose an option</p>
                <p className="mt-1 truncate font-serif text-xl text-ivory">{product.name}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-1 grid size-9 place-items-center rounded-full text-mute hover:text-ivory">
                <X className="size-5" />
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {product.variants.map((v) => {
                const soldOut = v.stockLeft !== null && v.stockLeft <= 0;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      disabled={soldOut}
                      onClick={() => onPick(v)}
                      className="flex min-h-14 w-full flex-col items-center justify-center rounded-lg border border-ink-600 px-2 py-2 text-center transition-colors hover:border-gold-500/60 hover:bg-gold-500/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className={cn("text-sm text-ivory", soldOut && "line-through")}>{v.label}</span>
                      <span className="text-[0.68rem] text-stone">{soldOut ? "Sold out" : formatPrice(v.price)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
