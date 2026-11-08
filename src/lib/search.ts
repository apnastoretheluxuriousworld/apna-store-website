import type { StoreProduct } from "@/lib/data/products";
import type { NavCategory } from "@/lib/site";

export type SearchResult = { q: string; collections: NavCategory[]; products: StoreProduct[] };

/** Normalised query: trimmed, single-spaced, max 80 chars. */
export const cleanQuery = (q: string | null | undefined) => (q ?? "").trim().replace(/\s+/g, " ").slice(0, 80);

/** Collections whose name/blurb contain every word, or whose name starts with one (3+ letters). */
export function matchCollections(categories: NavCategory[], q: string) {
  const words = q.toLowerCase().split(" ").filter(Boolean);
  if (!words.length) return [];
  return categories.filter((c) => {
    const text = `${c.name} ${c.blurb}`.toLowerCase();
    return words.every((w) => text.includes(w)) || words.some((w) => w.length > 2 && c.name.toLowerCase().startsWith(w));
  });
}
