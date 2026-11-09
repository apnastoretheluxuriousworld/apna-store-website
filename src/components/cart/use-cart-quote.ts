"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { quoteCart, type CartQuote } from "@/app/(store)/checkout/actions";
import { codBlockReason, computeTotals, lineKey, type CartItem } from "@/lib/validation/checkout";
import type { CartBundle } from "@/lib/validation/offer";
import { getBagSnapshot, useBundles, useCart } from "./cart-store";

const noopSubscribe = () => () => {};

const bagKeys = (items: CartItem[], bundles: CartBundle[]) =>
  [...items.map(lineKey).sort(), ...bundles.map((b) => `offer:${b.id}`)].join(",");

/*
 * Last prices the server gave (kept for this visit) and the request in flight.
 * The cart and checkout show the remembered prices at once and refresh them in
 * the background, so moving between them never waits on the server.
 */
let lastQuote: { keys: string; quote: CartQuote } | null = null;
let inflight: { keys: string; promise: ReturnType<typeof quoteCart> } | null = null;

function fetchQuote(items: CartItem[], bundles: CartBundle[]) {
  const keys = bagKeys(items, bundles);
  if (inflight?.keys === keys) return inflight.promise;
  const promise = quoteCart(items, bundles).then((res) => {
    if (res.ok) lastQuote = { keys, quote: res.data };
    return res;
  });
  inflight = { keys, promise };
  void promise.finally(() => {
    if (inflight?.promise === promise) inflight = null;
  });
  return promise;
}

/** Start pricing the bag now (e.g. on "Buy now", before checkout opens). */
export function prefetchCartQuote() {
  const { items, bundles } = getBagSnapshot();
  if (items.length || bundles.length) void fetchQuote(items, bundles);
}

export type BagLine = CartQuote["lines"][number] & { item: CartItem };
export type BagBundle = CartQuote["bundles"][number];

/**
 * The bag with live prices and stock from the server. Re-asks the server when
 * lines are added/removed (and when the tab comes back into focus); quantity
 * changes are worked out here, from the stock it already knows.
 */
export function useCartQuote() {
  const items = useCart();
  const bundleItems = useBundles();
  const keys = useMemo(() => bagKeys(items, bundleItems), [items, bundleItems]);
  // Start from the remembered prices when they're for this bag.
  const cached = lastQuote?.keys === keys ? lastQuote : null;
  const [quote, setQuote] = useState<CartQuote | null>(cached?.quote ?? null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedFor, setFetchedFor] = useState<string | null>(cached?.keys ?? null);
  const empty = items.length === 0 && bundleItems.length === 0;

  const refresh = useCallback(async (list: CartItem[], offers: CartBundle[], forKeys: string) => {
    if (!list.length && !offers.length) return;
    const res = await fetchQuote(list, offers);
    if (res.ok) {
      setQuote(res.data);
      setError(null);
    } else setError(res.error);
    setFetchedFor(forKeys);
  }, []);

  useEffect(() => {
    // Quantities don't change which lines exist, so only re-ask when the set of lines does.
    if (empty) return;
    let live = true;
    void fetchQuote(items, bundleItems).then((res) => {
      if (!live) return;
      if (res.ok) {
        setQuote(res.data);
        setError(null);
      } else setError(res.error);
      setFetchedFor(keys);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  useEffect(() => {
    const onFocus = () => document.visibilityState === "visible" && void refresh(items, bundleItems, keys);
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [items, bundleItems, keys, refresh]);

  const lines: BagLine[] = useMemo(() => {
    if (!quote) return [];
    return items.flatMap((item) => {
      const q = quote.lines.find((l) => l.key === lineKey(item));
      if (!q) return [];
      // Re-check stock against the quantity in the bag now.
      const tooMany = q.maxQty > 0 && item.qty > q.maxQty;
      const serverQtyIssue = q.issue?.startsWith("Only ");
      const issue = tooMany ? `Only ${q.maxQty} left` : serverQtyIssue ? null : q.issue;
      return [{ ...q, quantity: item.qty, issue, item }];
    });
  }, [items, quote]);

  // The bag lives in localStorage: until hydration we can't tell "empty" from "not read yet".
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  // Offer bundles as priced by the server, in the bag's order.
  const bundles = useMemo(
    () => (quote ? bundleItems.flatMap((b) => quote.bundles.filter((q) => q.id === b.id)) : []),
    [bundleItems, quote],
  );

  const settings = quote?.settings ?? null;
  /** Regular items only: what a coupon works on. */
  const itemsSubtotal = lines.filter((l) => !l.issue).reduce((n, l) => n + l.unitPrice * l.quantity, 0);
  const subtotal = itemsSubtotal + bundles.filter((b) => !b.issue).reduce((n, b) => n + b.price, 0);
  // Bag totals before a payment method is chosen (checkout adds the COD charge itself).
  const totals = settings ? computeTotals(subtotal, settings) : { subtotal, shippingFee: 0, codFee: 0, total: subtotal };
  const hasIssues = lines.some((l) => l.issue) || bundles.some((b) => b.issue);

  return {
    items,
    bundleItems,
    lines,
    bundles,
    itemsSubtotal,
    /** Nothing in the bag (no products and no offers). */
    empty,
    settings,
    totals,
    hasIssues,
    codBlocked: settings ? codBlockReason(totals.total, settings) : null,
    /** True until the server has answered for the current set of lines. */
    loading: !empty && fetchedFor !== keys,
    ready: hydrated && (empty || fetchedFor !== null),
    error,
    refresh: () => refresh(items, bundleItems, keys),
  };
}
