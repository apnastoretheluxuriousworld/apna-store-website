"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Gift, Minus, Plus, ShieldCheck, ShoppingBag, Trash2, Truck } from "lucide-react";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { removeBundle, removeFromCart, setCartQty } from "./cart-store";
import { useCartQuote, type BagBundle, type BagLine } from "./use-cart-quote";
import { PageLoader } from "@/components/ui/brand-loader";

export function CartView() {
  const { lines, bundles, totals, settings, hasIssues, loading, ready, error, empty } = useCartQuote();

  if (!ready || (loading && lines.length === 0 && bundles.length === 0 && !empty)) return <CartSkeleton />;

  if (empty) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
        <span className="grid size-20 place-items-center rounded-full border border-gold-500/25 bg-gold-500/5">
          <ShoppingBag className="size-8 text-gold-400" strokeWidth={1.1} />
        </span>
        <p className="mt-6 font-serif text-3xl text-ivory">Your cart is empty</p>
        <p className="mt-2 text-sm text-stone">Discover pieces made to be noticed.</p>
        <ButtonLink href="/shop" className="mt-8">
          Explore the collection
        </ButtonLink>
      </div>
    );
  }

  const count = lines.reduce((n, l) => n + l.quantity, 0) + bundles.reduce((n, b) => n + b.picks.length, 0);
  const freeFrom = settings && settings.shippingFee > 0 && settings.freeShippingAbove > 0 ? settings.freeShippingAbove : 0;
  const toFree = freeFrom ? freeFrom - totals.subtotal : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-10">
      <section aria-label="Items in your cart">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-mute">
          {count} {count === 1 ? "piece" : "pieces"}
        </p>
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {bundles.map((b) => (
              <motion.li
                key={`offer:${b.id}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
              >
                <BundleRow bundle={b} />
              </motion.li>
            ))}
            {lines.map((l) => (
              <motion.li
                key={l.key}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
              >
                <CartRow line={l} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </section>

      <aside className="h-fit space-y-4 lg:sticky lg:top-32">
        <div className="rounded-2xl border border-gold-500/20 bg-ink-850 p-5">
          <h2 className="eyebrow mb-4">Order summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between text-stone">
              <dt>Subtotal</dt>
              <dd className="text-ivory tabular-nums">{formatPrice(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-stone">
              <dt>Shipping</dt>
              <dd className="tabular-nums">{totals.shippingFee ? formatPrice(totals.shippingFee) : <span className="text-emerald-300">Free</span>}</dd>
            </div>
            <div className="hairline my-3" />
            <div className="flex items-baseline justify-between">
              <dt className="text-ivory">Total</dt>
              <dd className="font-serif text-2xl text-gold-300 tabular-nums">{formatPrice(totals.total)}</dd>
            </div>
          </dl>
          {toFree > 0 && (
            <p className="mt-3 rounded-lg bg-gold-500/5 px-3 py-2 text-xs text-gold-200/90">
              Add {formatPrice(toFree)} more for free shipping.
            </p>
          )}
          {hasIssues && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">
              <AlertCircle className="mt-px size-3.5 shrink-0" /> Please fix the highlighted items to continue.
            </p>
          )}
          <Link
            href="/checkout"
            aria-disabled={hasIssues || loading}
            className={cn(buttonClass("gold", "lg", "mt-5 w-full"), (hasIssues || loading) && "pointer-events-none opacity-50")}
          >
            Checkout
          </Link>
          <Link href="/shop" className="mt-3 block text-center text-xs uppercase tracking-[0.18em] text-stone hover:text-gold-300">
            Continue shopping
          </Link>
        </div>
        <ul className="space-y-2 px-1 text-xs text-stone">
          <li className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-gold-400" strokeWidth={1.4} /> Pay by UPI or cash on delivery
          </li>
          <li className="flex items-center gap-2">
            <Truck className="size-4 text-gold-400" strokeWidth={1.4} /> Packed with care, tracked to your door
          </li>
        </ul>
      </aside>
    </div>
  );
}

function CartRow({ line: l }: { line: BagLine }) {
  const unavailable = l.maxQty === 0;
  return (
    <div className={cn("flex gap-3 rounded-2xl border bg-ink-850 p-3 sm:gap-4 sm:p-4", l.issue ? "border-red-400/40" : "border-ink-600/80")}>
      <Link href={`/shop/${l.categorySlug}`} className="relative aspect-4/5 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-900 sm:w-24">
        {l.image ? (
          <Image src={l.image} alt="" fill sizes="96px" className={cn("object-cover", unavailable && "opacity-40 grayscale")} />
        ) : (
          <ShoppingBag className="absolute inset-0 m-auto size-6 text-mute" strokeWidth={1.2} />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-gold-400">{l.name}</p>
            {l.variantLabel && <p className="mt-0.5 text-xs text-stone">{l.variantLabel}</p>}
          </div>
          <button
            type="button"
            onClick={() => removeFromCart(l.key)}
            aria-label={`Remove ${l.name} from cart`}
            className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 className="size-4" strokeWidth={1.5} />
          </button>
        </div>
        <p className="mt-1 flex items-baseline gap-2 text-sm text-ivory">
          {formatPrice(l.unitPrice)}
          {l.compareAtPrice != null && l.compareAtPrice > l.unitPrice && (
            <s className="text-[0.7rem] text-mute">{formatPrice(l.compareAtPrice)}</s>
          )}
        </p>
        {l.issue && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-red-300">
            <AlertCircle className="size-3.5" /> {l.issue}
            {l.maxQty > 0 && l.quantity > l.maxQty && (
              <button type="button" onClick={() => setCartQty(l.key, l.maxQty)} className="ml-1 underline underline-offset-2 hover:text-red-200">
                Update to {l.maxQty}
              </button>
            )}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between pt-3">
          {unavailable ? (
            <span className="text-xs text-mute">Remove to continue</span>
          ) : (
            <div className="inline-flex items-center rounded-lg border border-ink-600" role="group" aria-label="Quantity">
              <button
                type="button"
                onClick={() => setCartQty(l.key, l.quantity - 1)}
                aria-label="One less"
                className="grid size-9 place-items-center text-stone hover:text-gold-300"
              >
                <Minus className="size-3.5" />
              </button>
              <span className="w-8 text-center text-sm text-ivory tabular-nums" aria-live="polite">
                {l.quantity}
              </span>
              <button
                type="button"
                onClick={() => setCartQty(l.key, l.quantity + 1)}
                disabled={l.quantity >= l.maxQty}
                aria-label="One more"
                className="grid size-9 place-items-center text-stone hover:text-gold-300 disabled:opacity-30"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          )}
          {!unavailable && <p className="text-sm font-medium text-ivory tabular-nums">{formatPrice(l.unitPrice * l.quantity)}</p>}
        </div>
      </div>
    </div>
  );
}

/** An offer in the bag: one price for the items the customer chose. */
function BundleRow({ bundle: b }: { bundle: BagBundle }) {
  const saving = b.listTotal - b.price;
  return (
    <div className={cn("rounded-2xl border bg-ink-850 p-3 sm:p-4", b.issue ? "border-red-400/40" : "border-gold-500/30")} data-testid="cart-bundle">
      <div className="flex items-start gap-3 sm:gap-4">
        <Link
          href={b.slug ? `/offers/${b.slug}` : "/"}
          className="relative grid aspect-4/5 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-ink-900 sm:w-24"
        >
          {b.coverUrl ? (
            <Image src={b.coverUrl} alt="" fill sizes="96px" className={cn("object-cover", b.issue && "opacity-50 grayscale")} />
          ) : (
            <Gift className="size-6 text-mute" strokeWidth={1.2} />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.2em] text-gold-400/80">
                <Gift className="size-3" strokeWidth={1.6} /> Offer
              </p>
              <p className="mt-0.5 truncate font-serif text-lg leading-tight text-ivory">{b.title}</p>
            </div>
            <button
              type="button"
              onClick={() => removeBundle(b.id)}
              aria-label={`Remove offer ${b.title} from cart`}
              className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="size-4" strokeWidth={1.5} />
            </button>
          </div>
          <p className="mt-1 flex items-baseline gap-2 text-sm text-ivory tabular-nums">
            {formatPrice(b.price)}
            {saving > 0 && <s className="text-[0.7rem] text-mute">{formatPrice(b.listTotal)}</s>}
            {saving > 0 && !b.issue && <span className="text-[0.7rem] text-emerald-300">You save {formatPrice(saving)}</span>}
          </p>
          {b.issue && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-red-300">
              <AlertCircle className="mt-px size-3.5 shrink-0" />
              <span>
                {b.issue}.{" "}
                {b.slug && b.issue !== "This offer has ended" ? (
                  <Link href={`/offers/${b.slug}`} className="underline underline-offset-2 hover:text-red-200" onClick={() => removeBundle(b.id)}>
                    Choose again
                  </Link>
                ) : (
                  "Remove to continue."
                )}
              </span>
            </p>
          )}
        </div>
      </div>
      <ul className="mt-3 space-y-2 border-t border-ink-600/60 pt-3">
        {b.picks.map((p, i) => (
          <li key={`${p.productId}:${p.variantId}:${i}`} className="flex items-center gap-2.5">
            <span className="relative aspect-4/5 w-8 shrink-0 overflow-hidden rounded bg-ink-900">
              {p.image && <Image src={p.image} alt="" fill sizes="32px" className="object-cover" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-ivory">{p.name}</span>
              {p.variantLabel && <span className="block text-[0.68rem] text-stone">{p.variantLabel}</span>}
            </span>
            <s className="text-[0.68rem] text-mute tabular-nums">{formatPrice(p.listPrice)}</s>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CartSkeleton() {
  return <PageLoader label="Loading your cart" />;
}
