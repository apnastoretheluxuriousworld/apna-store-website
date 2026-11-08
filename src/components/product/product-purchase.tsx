"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Check } from "lucide-react";
import { WhatsappIcon } from "@/components/brand/social-icons";
import { addToCart, removeFromCart, useCart } from "@/components/cart/cart-store";
import { Button } from "@/components/ui/button";
import type { StoreProductDetail, StoreVariant } from "@/lib/data/products";
import { formatPrice } from "@/lib/format";
import { MAX_QTY_PER_LINE, lineKey } from "@/lib/validation/checkout";
import { cn } from "@/lib/utils";

type Props = Pick<StoreProductDetail, "id" | "name" | "price" | "compareAtPrice" | "inStock" | "stockLeft" | "variants">;

/**
 * Price, options, Add to bag / Buy now and "Ask on WhatsApp". On phones a slim
 * bar with the price and Add to bag sticks above the bottom navigation once the
 * main buttons scroll out of view.
 */
export function ProductPurchase({ product, whatsappUrl }: { product: Props; whatsappUrl: string | null }) {
  const router = useRouter();
  const hasOptions = product.variants.length > 0;
  const [variant, setVariant] = useState<StoreVariant | null>(() =>
    // A single option needs no choosing.
    product.variants.length === 1 ? product.variants[0] : null,
  );
  const [needsChoice, setNeedsChoice] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  // Inline note under the buttons (no toasts for the bag).
  const [note, setNote] = useState<"added" | "max" | null>(null);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 3500);
    return () => clearTimeout(t);
  }, [note]);
  const actions = useRef<HTMLDivElement>(null);
  const options = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = actions.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const price = variant?.price ?? product.price;
  const variantPrices = new Set(product.variants.map((v) => v.price));
  const fromPrice = hasOptions && !variant && variantPrices.size > 1 ? Math.min(...variantPrices) : null;
  const compareAt = product.compareAtPrice != null && product.compareAtPrice > price ? product.compareAtPrice : null;
  const off = compareAt ? Math.round((1 - price / compareAt) * 100) : 0;
  const left = variant ? variant.stockLeft : hasOptions ? null : product.stockLeft;
  // Is the piece shown (with the chosen option) already in the bag? Then the button removes it.
  const bag = useCart();
  const key = hasOptions && !variant ? null : lineKey({ productId: product.id, variantId: variant?.id ?? null });
  const inBag = key != null && bag.some((i) => lineKey(i) === key);
  const soldOut = !product.inStock || (variant != null && variant.stockLeft !== null && variant.stockLeft <= 0);

  /** Puts the chosen piece in the bag; false if an option must be chosen first. */
  function add(): boolean {
    if (hasOptions && !variant) {
      setNeedsChoice(true);
      options.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    const max = (variant ? variant.stockLeft : product.stockLeft) ?? MAX_QTY_PER_LINE;
    return addToCart({ productId: product.id, variantId: variant?.id ?? null }, 1, max);
  }

  function onRemove() {
    if (!key) return;
    removeFromCart(key);
    setNote(null);
  }

  function onAdd() {
    if (inBag) return onRemove();
    if (hasOptions && !variant) return void add();
    setNote(add() ? "added" : "max");
  }

  function onBuyNow() {
    if (hasOptions && !variant) return void add();
    if (!inBag) add(); // already in the bag is fine — go to checkout with what's in it
    router.push("/checkout");
  }

  /** wa.me chats get a prefilled message naming the piece (built on tap — the URL is only known in the browser). */
  const chat = whatsappUrl?.startsWith("https://wa.me/") ?? false;
  const waMessage = () =>
    `${whatsappUrl}?text=${encodeURIComponent(`Hi, I'm interested in ${product.name}${variant ? ` (${variant.label})` : ""}: ${window.location.href}`)}`;

  return (
    <>
      {/* Price */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-serif text-3xl text-ivory lg:text-4xl">
          {fromPrice != null && <span className="mr-1.5 text-base text-stone">From</span>}
          {formatPrice(fromPrice ?? price)}
        </p>
        {compareAt && fromPrice == null && (
          <>
            <s className="text-sm text-mute">{formatPrice(compareAt)}</s>
            <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-[0.65rem] font-semibold tracking-wider text-gold-300 uppercase">
              {off}% off
            </span>
          </>
        )}
      </div>
      <p className="mt-1 text-[0.7rem] text-mute">Inclusive of all taxes</p>

      {/* Options */}
      {hasOptions && (
        <div ref={options} className="mt-6 scroll-mt-28">
          <p className={cn("mb-2.5 text-[0.65rem] uppercase tracking-[0.22em]", needsChoice && !variant ? "text-red-300" : "text-stone")}>
            {variant ? <>Option · <span className="text-ivory">{variant.label}</span></> : "Choose an option"}
          </p>
          <motion.div
            className="flex flex-wrap gap-2"
            animate={needsChoice && !variant ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
            onAnimationComplete={() => setNeedsChoice(false)}
          >
            {product.variants.map((v) => {
              const out = v.stockLeft !== null && v.stockLeft <= 0;
              const selected = variant?.id === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={out}
                  aria-pressed={selected}
                  onClick={() => setVariant(v)}
                  className={cn(
                    "min-h-11 min-w-14 rounded-lg border px-3.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    selected ? "border-gold-400 bg-gold-500/10 text-gold-200" : "border-ink-600 text-ivory hover:border-gold-500/50",
                    out && "line-through",
                  )}
                >
                  {v.label}
                  {variantPrices.size > 1 && <span className="ml-1.5 text-[0.7rem] text-stone">{formatPrice(v.price)}</span>}
                </button>
              );
            })}
          </motion.div>
        </div>
      )}

      {left != null && left > 0 && left <= 3 && !soldOut && (
        <p className="mt-4 text-xs text-gold-300">Only {left} left</p>
      )}

      {/* Actions */}
      <div ref={actions} className="mt-6 grid gap-2.5 sm:grid-cols-2">
        {soldOut ? (
          <Button variant="outline" size="lg" className="sm:col-span-2" disabled>
            Sold out
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              variant={inBag ? "outline" : "gold"}
              onClick={onAdd}
              aria-label={inBag ? `${product.name} is in your cart — tap to remove` : undefined}
              title={inBag ? "In your cart — tap to remove" : undefined}
              className="group"
            >
              {inBag ? (
                <>
                  <Check className="size-4" /> Added to cart
                </>
              ) : (
                "Add to cart"
              )}
            </Button>
            <Button variant="outline" size="lg" onClick={onBuyNow}>
              Buy now
            </Button>
          </>
        )}
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            onClick={(e) => {
              if (chat) e.currentTarget.href = waMessage();
            }}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center justify-center gap-2 rounded-md text-xs tracking-[0.18em] text-stone uppercase transition-colors hover:text-gold-300 sm:col-span-2"
          >
            <WhatsappIcon className="size-4 text-gold-400" /> Ask on WhatsApp
          </a>
        )}
      </div>

      {/* Bag feedback, inline (no toasts) */}
      <div aria-live="polite" className="min-h-0">
        <AnimatePresence>
          {note && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden text-center text-xs text-stone"
            >
              <span className="inline-flex items-center gap-1.5 pt-1">
                {note === "added" ? (
                  <>
                    <Check className="size-3.5 text-gold-400" /> Added to your cart
                  </>
                ) : (
                  "You have the most we can offer of this in your cart"
                )}
                <span className="text-mute">·</span>
                <Link href="/cart" className="text-gold-300 hover:underline">
                  View cart →
                </Link>
              </span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Phones: sticky price + Add to bag above the bottom navigation */}
      <AnimatePresence>
        {showSticky && !soldOut && (
          <motion.div
            className="fixed inset-x-0 z-40 border-t border-gold-500/15 bg-ink-950/95 px-4 py-2.5 backdrop-blur-xl lg:hidden"
            style={{ bottom: "calc(var(--bottom-bar-h) + env(safe-area-inset-bottom))" }}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
          >
            <div className="mx-auto flex max-w-md items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-stone">{product.name}</p>
                <p className="font-serif text-lg leading-tight text-ivory">{formatPrice(fromPrice ?? price)}</p>
              </div>
              <Button size="md" variant={inBag ? "outline" : "gold"} onClick={onAdd} className="shrink-0">
                {inBag ? (
                  <>
                    <Check className="size-4" /> Added
                  </>
                ) : hasOptions && !variant ? (
                  "Choose option"
                ) : (
                  "Add to cart"
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
