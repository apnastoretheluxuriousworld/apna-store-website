"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { quoteCart, type CartQuote } from "@/app/(store)/checkout/actions";
import { codBlockReason, computeTotals, lineKey, type CartItem } from "@/lib/validation/checkout";
import { useCart } from "./cart-store";

const noopSubscribe = () => () => {};

export type BagLine = CartQuote["lines"][number] & { item: CartItem };

/**
 * The bag with live prices and stock from the server. Re-asks the server when
 * lines are added/removed (and when the tab comes back into focus); quantity
 * changes are worked out here, from the stock it already knows.
 */
export function useCartQuote() {
  const items = useCart();
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedFor, setFetchedFor] = useState<string | null>(null);

  const keys = useMemo(() => items.map(lineKey).sort().join(","), [items]);

  const refresh = useCallback(async (list: CartItem[], forKeys: string) => {
    if (!list.length) return;
    const res = await quoteCart(list);
    if (res.ok) {
      setQuote(res.data);
      setError(null);
    } else setError(res.error);
    setFetchedFor(forKeys);
  }, []);

  useEffect(() => {
    // Quantities don't change which lines exist, so only re-ask when the set of lines does.
    if (!items.length) return;
    let live = true;
    void quoteCart(items).then((res) => {
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
    const onFocus = () => document.visibilityState === "visible" && void refresh(items, keys);
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [items, keys, refresh]);

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
  const settings = quote?.settings ?? null;
  const subtotal = lines.filter((l) => !l.issue).reduce((n, l) => n + l.unitPrice * l.quantity, 0);
  // Bag totals before a payment method is chosen (checkout adds the COD charge itself).
  const totals = settings ? computeTotals(subtotal, settings) : { subtotal, shippingFee: 0, codFee: 0, total: subtotal };
  const hasIssues = lines.some((l) => l.issue);

  return {
    items,
    lines,
    settings,
    totals,
    hasIssues,
    codBlocked: settings ? codBlockReason(totals.total, settings) : null,
    /** True until the server has answered for the current set of lines. */
    loading: items.length > 0 && fetchedFor !== keys,
    ready: hydrated && (items.length === 0 || fetchedFor !== null),
    error,
    refresh: () => refresh(items, keys),
  };
}
