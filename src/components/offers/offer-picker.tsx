"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { CategoryIcon } from "@/components/brand/category-icon";
import { VariantSheet } from "@/components/cart/add-to-bag";
import { addBundle } from "@/components/cart/cart-store";
import { Button, ButtonLink } from "@/components/ui/button";
import type { StoreProduct, StoreVariant } from "@/lib/data/products";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type Pick = { productId: string; variantId: string | null };
type OfferInfo = { id: string; slug: string; title: string; pickCount: number; price: number };

/** Products the customer gets without choosing (a fixed combo), when they need no size/option. */
function initialPicks(offer: OfferInfo, products: StoreProduct[]): Pick[] {
  if (products.length !== offer.pickCount) return [];
  return products.filter((p) => p.inStock && !p.variants.length).map((p) => ({ productId: p.id, variantId: null }));
}

/**
 * "Choose 3": the customer picks the offer's items (the same one more than
 * once is fine, stock allowing), then adds the whole set to the bag as one
 * line at the offer price.
 */
export function OfferPicker({ offer, products }: { offer: OfferInfo; products: StoreProduct[] }) {
  const [picks, setPicks] = useState<Pick[]>(() => initialPicks(offer, products));
  const [sheetFor, setSheetFor] = useState<StoreProduct | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const full = picks.length >= offer.pickCount;
  const done = picks.length === offer.pickCount;
  const countOf = (productId: string) => picks.filter((p) => p.productId === productId).length;
  const product = (id: string) => products.find((p) => p.id === id)!;
  const listTotal = picks.reduce((n, p) => n + priceOf(product(p.productId), p.variantId), 0);

  // Stock left for one more of this product/option, after what's already picked.
  function canAddMore(p: StoreProduct, variantId: string | null) {
    const left = variantId ? p.variants.find((v) => v.id === variantId)?.stockLeft : p.stockLeft;
    if (left == null) return true;
    return picks.filter((x) => x.productId === p.id && x.variantId === variantId).length < left;
  }

  function add(p: StoreProduct, variant: StoreVariant | null) {
    setAdded(false);
    if (full) {
      setNotice(`You've chosen ${offer.pickCount}. Remove one to change your mix.`);
      return;
    }
    if (!canAddMore(p, variant?.id ?? null)) {
      setNotice(`No more ${p.name}${variant ? ` (${variant.label})` : ""} in stock.`);
      return;
    }
    setNotice(null);
    setPicks((all) => [...all, { productId: p.id, variantId: variant?.id ?? null }]);
  }

  function tap(p: StoreProduct) {
    if (p.variants.length) {
      if (full) setNotice(`You've chosen ${offer.pickCount}. Remove one to change your mix.`);
      else setSheetFor(p);
    } else add(p, null);
  }

  function removeLastOf(productId: string) {
    setAdded(false);
    setNotice(null);
    setPicks((all) => {
      const i = all.map((x) => x.productId).lastIndexOf(productId);
      return i < 0 ? all : all.filter((_, j) => j !== i);
    });
  }

  function removeAt(i: number) {
    setAdded(false);
    setNotice(null);
    setPicks((all) => all.filter((_, j) => j !== i));
  }

  function addToBag() {
    if (!done) return;
    if (!addBundle(offer.id, picks)) {
      setNotice("Your cart already holds the most offers it can. Check out or remove one first.");
      return;
    }
    setAdded(true);
    setNotice(null);
    setPicks(initialPicks(offer, products));
  }

  // The floating WhatsApp button sits above the sticky bar while it's showing (phones).
  useEffect(() => {
    document.documentElement.dataset.stickyCta = "";
    return () => {
      delete document.documentElement.dataset.stickyCta;
    };
  }, []);

  const tray = (compact: boolean) => (
    <Tray
      compact={compact}
      offer={offer}
      picks={picks}
      product={product}
      listTotal={listTotal}
      done={done}
      added={added}
      notice={notice}
      onRemove={removeAt}
      onAdd={addToBag}
    />
  );

  return (
    <>
      <div className="mt-8 flex items-end justify-between gap-3">
        <h2 className="text-[0.8rem] font-medium uppercase tracking-[0.22em] text-ivory">
          {products.length === offer.pickCount ? "In this offer" : `Choose any ${offer.pickCount}`}
        </h2>
        <span className="text-xs text-gold-300 tabular-nums" aria-live="polite">
          {picks.length} / {offer.pickCount} chosen
        </span>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
        {products.map((p) => {
          const n = countOf(p.id);
          const soldOut = !p.inStock || (p.variants.length > 0 && p.variants.every((v) => v.stockLeft !== null && v.stockLeft <= 0));
          return (
            <li key={p.id}>
              <ProductTile
                product={p}
                count={n}
                soldOut={soldOut}
                full={full}
                canAddMore={!p.variants.length ? canAddMore(p, null) : true}
                onTap={() => tap(p)}
                onLess={() => removeLastOf(p.id)}
              />
            </li>
          );
        })}
      </ul>

      {/* Desktop: summary under the grid. Phones: a sticky bar above the bottom navigation. */}
      {/* (One row on phones, so it fits where the WhatsApp button already makes room for a sticky bar.) */}
      <div className="mt-6 hidden lg:block">{tray(false)}</div>
      <div
        className="fixed inset-x-0 z-40 border-t border-gold-500/15 bg-ink-950/95 px-4 py-2.5 backdrop-blur-xl lg:hidden"
        style={{ bottom: "calc(var(--bottom-bar-h) + env(safe-area-inset-bottom))" }}
      >
        {tray(true)}
      </div>
      {/* Room for the sticky bar so the last products aren't hidden under it. */}
      <div className="h-24 lg:hidden" aria-hidden />

      {sheetFor && (
        <VariantSheet
          product={sheetFor}
          open={!!sheetFor}
          onClose={() => setSheetFor(null)}
          onPick={(v) => {
            add(sheetFor, v);
            setSheetFor(null);
          }}
        />
      )}
    </>
  );
}

const priceOf = (p: StoreProduct, variantId: string | null) => (variantId ? p.variants.find((v) => v.id === variantId)?.price : null) ?? p.price;

function ProductTile({
  product: p,
  count,
  soldOut,
  full,
  canAddMore,
  onTap,
  onLess,
}: {
  product: StoreProduct;
  count: number;
  soldOut: boolean;
  full: boolean;
  canAddMore: boolean;
  onTap: () => void;
  onLess: () => void;
}) {
  const on = count > 0;
  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-xl border bg-ink-800/70 transition-colors",
        on ? "border-gold-400/80 shadow-[0_0_24px_-10px_rgba(212,175,55,0.7)]" : "border-gold-500/10",
        soldOut && "opacity-50",
      )}
      data-testid="offer-product"
    >
      <button
        type="button"
        onClick={onTap}
        disabled={soldOut}
        aria-label={soldOut ? `${p.name} is sold out` : `Choose ${p.name}${p.variants.length ? " (pick an option)" : ""}`}
        className="relative block aspect-4/5 w-full overflow-hidden bg-ink-950 text-left disabled:cursor-not-allowed"
      >
        {p.image ? (
          <Image src={p.image} alt="" fill sizes="(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 50vw" className="object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center">
            <CategoryIcon slug={p.categorySlug} className="size-12 text-gold-400/70" strokeWidth={0.75} />
          </span>
        )}
        <AnimatePresence>
          {on && (
            <motion.span
              key={count}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="bg-gold absolute top-2 right-2 grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-xs font-semibold text-ink-950 tabular-nums"
            >
              {count > 1 ? `×${count}` : <Check className="size-4" strokeWidth={3} />}
            </motion.span>
          )}
        </AnimatePresence>
        {soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-ink-950/80 py-1.5 text-center text-[0.65rem] uppercase tracking-[0.2em] text-stone">Sold out</span>
        )}
      </button>
      <div className="flex flex-1 flex-col p-2.5">
        <p className="truncate text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-gold-400">{p.name}</p>
        <p className="mt-0.5 text-[0.7rem] text-mute tabular-nums">
          Normally {formatPrice(p.price)}
          {p.variants.length > 0 && " · options"}
        </p>
        <div className="mt-auto pt-2">
          {on ? (
            <div className="flex items-center justify-between rounded-lg border border-gold-500/40">
              <button type="button" onClick={onLess} aria-label={`One less ${p.name}`} className="grid size-8 place-items-center text-stone hover:text-gold-300">
                <Minus className="size-3.5" />
              </button>
              <span className="text-xs text-ivory tabular-nums">{count}</span>
              <button
                type="button"
                onClick={onTap}
                disabled={full || !canAddMore}
                aria-label={`One more ${p.name}`}
                className="grid size-8 place-items-center text-stone hover:text-gold-300 disabled:opacity-30"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onTap}
              disabled={soldOut}
              className={cn(
                "h-8 w-full rounded-lg border text-[0.65rem] uppercase tracking-[0.18em] transition-colors disabled:opacity-40",
                full ? "border-ink-600 text-mute" : "border-gold-500/40 text-gold-300 hover:bg-gold-500/10",
              )}
            >
              Choose
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Tray({
  compact,
  offer,
  picks,
  product,
  listTotal,
  done,
  added,
  notice,
  onRemove,
  onAdd,
}: {
  /** Phones: one row (choices + button), no saving line. */
  compact: boolean;
  offer: OfferInfo;
  picks: Pick[];
  product: (id: string) => StoreProduct;
  listTotal: number;
  done: boolean;
  added: boolean;
  notice: string | null;
  onRemove: (i: number) => void;
  onAdd: () => void;
}) {
  const slots = Array.from({ length: offer.pickCount }, (_, i) => picks[i] ?? null);
  const saving = done ? listTotal - offer.price : 0;

  if (added) {
    return (
      <div className={cn("flex items-center gap-3", !compact && "rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4")} role="status">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
          <Check className="size-4.5" />
        </span>
        <p className="min-w-0 flex-1 text-sm text-ivory">
          Added to your cart
          {!compact && <span className="block text-xs text-stone">Want another set? Choose again.</span>}
        </p>
        <ButtonLink href="/cart" size="md" className="shrink-0 px-4">
          <ShoppingBag className="size-3.5" /> View cart
        </ButtonLink>
      </div>
    );
  }

  const slotRow = (
    <div className={cn("flex items-center gap-1.5 overflow-x-auto scrollbar-none", compact && "min-w-0 flex-1")} aria-label="Your choices">
        {slots.map((pick, i) =>
          pick ? (
            <span key={i} className={cn("relative aspect-4/5 shrink-0 overflow-hidden rounded-md border border-gold-500/50 bg-ink-900", compact ? "w-9" : "w-12")}>
              {product(pick.productId).image && <Image src={product(pick.productId).image!} alt="" fill sizes="48px" className="object-cover" />}
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Remove ${product(pick.productId).name}${pick.variantId ? ` (${product(pick.productId).variants.find((v) => v.id === pick.variantId)?.label})` : ""}`}
                className="absolute top-0 right-0 grid size-4.5 place-items-center rounded-bl-md bg-ink-950/85 text-ivory"
              >
                <X className="size-3" />
              </button>
            </span>
          ) : (
            <span
              key={i}
              className={cn(
                "grid aspect-4/5 shrink-0 place-items-center rounded-md border border-dashed border-ink-500 text-[0.65rem] text-mute tabular-nums",
                compact ? "w-9" : "w-12",
              )}
            >
              {i + 1}
            </span>
          ),
        )}
        {!compact && (
          <span className="ml-auto shrink-0 pl-2 text-right">
            <span className="block font-serif text-xl leading-none text-gold-300 tabular-nums">{formatPrice(offer.price)}</span>
            {saving > 0 && (
              <span className="mt-1 block text-[0.65rem] text-emerald-300 tabular-nums">
                <s className="text-mute">{formatPrice(listTotal)}</s> save {formatPrice(saving)}
              </span>
            )}
          </span>
        )}
      </div>
  );
  const noticeLine = notice && (
    <p className={cn("text-xs text-amber-200", compact ? "mb-2" : "mt-2")} role="alert">
      {notice}
    </p>
  );
  const button = (
    <Button type="button" onClick={onAdd} disabled={!done} className={compact ? "shrink-0 px-4" : "mt-3 w-full"} data-testid="offer-add">
      {done ? (
        <>
          <ShoppingBag className="size-3.5" /> {compact ? `Add · ${formatPrice(offer.price)}` : "Add to cart"}
        </>
      ) : (
        `Choose ${offer.pickCount - picks.length} more`
      )}
    </Button>
  );

  if (compact) {
    return (
      <div>
        {noticeLine}
        <div className="flex items-center gap-3">
          {slotRow}
          {button}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-gold-500/20 bg-ink-850 p-5">
      {slotRow}
      {noticeLine}
      {button}
    </div>
  );
}
