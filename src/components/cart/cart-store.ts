"use client";

/**
 * The shopping bag, kept in this browser (localStorage) so it works for
 * guests and survives reloads; other tabs follow via the "storage" event.
 * Only ids and quantities live here: names, prices and stock always come
 * fresh from the server (quoteCart / placeOrder).
 */
import { useSyncExternalStore } from "react";
import { MAX_CART_LINES, MAX_QTY_PER_LINE, lineKey, type CartItem } from "@/lib/validation/checkout";

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

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  items = read();
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    items = read();
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

export function useCartCount() {
  return useCart().reduce((n, i) => n + i.qty, 0);
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
}
