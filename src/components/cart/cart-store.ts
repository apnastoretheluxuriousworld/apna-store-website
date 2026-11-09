"use client";

/**
 * The shopping bag, kept in this browser (localStorage) so it works for
 * guests and survives reloads; other tabs follow via the "storage" event.
 * Only ids and quantities live here: names, prices and stock always come
 * fresh from the server (quoteCart / placeOrder).
 */
import { useSyncExternalStore } from "react";
import { MAX_CART_LINES, MAX_QTY_PER_LINE, lineKey, type CartItem } from "@/lib/validation/checkout";
import { MAX_BUNDLES, bundleSchema, type BundlePickInput, type CartBundle } from "@/lib/validation/offer";

const KEY = "apna-bag-v1";
const EMPTY: CartItem[] = [];
let items: CartItem[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

const isItem = (x: unknown): x is CartItem => {
  const i = x as CartItem;
  return !!i && typeof i.productId === "string" && (i.variantId === null || typeof i.variantId === "string") && Number.isInteger(i.qty) && i.qty > 0;
};

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter(isItem).map((i) => ({ ...i, qty: Math.min(i.qty, MAX_QTY_PER_LINE) })) : [];
  } catch {
    return [];
  }
}

/*
 * Offer bundles ("Any 3 for ₹1,000") live under their own key: each is one
 * offer with the items the customer chose for it, priced by the server.
 */
const BUNDLES_KEY = "apna-offers-v1";
const NO_BUNDLES: CartBundle[] = [];
let bundles: CartBundle[] = NO_BUNDLES;

function readBundles() {
  try {
    const raw = JSON.parse(localStorage.getItem(BUNDLES_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((b) => bundleSchema.safeParse(b).success).slice(0, MAX_BUNDLES) : [];
  } catch {
    return [];
  }
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  items = read();
  bundles = readBundles();
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) items = read();
    else if (e.key === BUNDLES_KEY) bundles = readBundles();
    else return;
    listeners.forEach((l) => l());
  });
}

function commit(next: CartItem[]) {
  items = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode / full: the bag still works for this visit */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
}

const snapshot = () => {
  load();
  return items;
};

/** The bag's lines (empty during server rendering). */
export function useCart() {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/** Offer bundles in the bag (empty during server rendering). */
export function useBundles() {
  return useSyncExternalStore(subscribe, bundleSnapshot, () => NO_BUNDLES);
}

const bundleSnapshot = () => {
  load();
  return bundles;
};

/** Pieces in the bag: product quantities plus every item chosen in an offer. */
export function useCartCount() {
  const n = useCart().reduce((t, i) => t + i.qty, 0);
  return n + useBundles().reduce((t, b) => t + b.picks.length, 0);
}

function commitBundles(next: CartBundle[]) {
  bundles = next;
  try {
    localStorage.setItem(BUNDLES_KEY, JSON.stringify(next));
  } catch {
    /* private mode / full: the bag still works for this visit */
  }
  listeners.forEach((l) => l());
}

/** Adds one offer with the chosen items. Returns false when the bag already holds the most offers it can. */
export function addBundle(offerId: string, picks: BundlePickInput[]): boolean {
  load();
  if (bundles.length >= MAX_BUNDLES) return false;
  commitBundles([...bundles, { id: crypto.randomUUID(), offerId, picks: picks.map((p) => ({ productId: p.productId, variantId: p.variantId })) }]);
  return true;
}

export function removeBundle(id: string) {
  load();
  commitBundles(bundles.filter((b) => b.id !== id));
}

/** Adds to the line (or creates it). Returns false when the bag can't take more. */
export function addToCart(item: Omit<CartItem, "qty">, qty = 1, max = MAX_QTY_PER_LINE): boolean {
  load();
  const k = lineKey(item);
  const existing = items.find((i) => lineKey(i) === k);
  const limit = Math.min(max, MAX_QTY_PER_LINE);
  if (existing) {
    if (existing.qty >= limit) return false;
    commit(items.map((i) => (lineKey(i) === k ? { ...i, qty: Math.min(limit, i.qty + qty) } : i)));
    return true;
  }
  if (items.length >= MAX_CART_LINES) return false;
  commit([...items, { productId: item.productId, variantId: item.variantId, qty: Math.min(limit, qty) }]);
  return true;
}

export function setCartQty(key: string, qty: number) {
  load();
  if (qty <= 0) return removeFromCart(key);
  commit(items.map((i) => (lineKey(i) === key ? { ...i, qty: Math.min(qty, MAX_QTY_PER_LINE) } : i)));
}

export function removeFromCart(key: string) {
  load();
  commit(items.filter((i) => lineKey(i) !== key));
}

export function clearCart() {
  load();
  commit([]);
  commitBundles([]);
}
