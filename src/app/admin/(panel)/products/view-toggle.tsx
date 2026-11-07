"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

import { PRODUCTS_VIEW_COOKIE, type ProductsView } from "./view";

const Ctx = createContext<{ view: ProductsView; setView: (v: ProductsView) => void }>({
  view: "list",
  setView: () => {},
});

const STORAGE_KEY = "apna-admin-products-view";
const listeners = new Set<() => void>();

function read(): ProductsView | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "list" || v === "grid" ? v : null;
  } catch {
    return null; // storage blocked (private mode)
  }
}

function remember(v: ProductsView) {
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {
    /* storage blocked — the cookie still works */
  }
  // Mirrored to a cookie so the server renders the right view on first paint (no flicker).
  document.cookie = `${PRODUCTS_VIEW_COOKIE}=${v}; path=/; max-age=31536000; samesite=lax`;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && l(); // other tabs
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * The list/card choice, saved in localStorage (survives hard refresh, restarts).
 * `initial` comes from the cookie, so the server's first render already matches.
 */
export function ProductsViewProvider({ initial, children }: { initial: ProductsView; children: React.ReactNode }) {
  const view = useSyncExternalStore(subscribe, () => read() ?? initial, () => initial);

  // Keep the cookie in step with localStorage (e.g. if cookies were cleared).
  useEffect(() => {
    const saved = read();
    if (saved && saved !== initial) remember(saved);
  }, [initial]);

  return <Ctx.Provider value={{ view, setView: remember }}>{children}</Ctx.Provider>;
}

export const useProductsView = () => useContext(Ctx).view;

export function ViewToggle() {
  const { view, setView } = useContext(Ctx);
  const btn = (v: ProductsView, label: string, Icon: typeof List) => (
    <button
      type="button"
      onClick={() => setView(v)}
      aria-label={label}
      aria-pressed={view === v}
      title={label}
      className={cn(
        "grid size-9 place-items-center rounded-md transition-colors",
        view === v ? "bg-gold-500/15 text-gold-300" : "text-mute hover:text-ivory",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
  return (
    <div className="flex h-11 shrink-0 items-center gap-0.5 rounded-lg border border-ink-600 bg-ink-900 px-0.5">
      {btn("list", "List view", List)}
      {btn("grid", "Card view", LayoutGrid)}
    </div>
  );
}
