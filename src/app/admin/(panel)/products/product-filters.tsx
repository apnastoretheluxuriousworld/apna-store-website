"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { inputClass } from "@/components/admin/form";
import type { ProductSort } from "@/lib/data/products";
import { cn } from "@/lib/utils";
import { ViewToggle } from "./view-toggle";

type Filters = {
  q?: string;
  category?: string;
  status?: "draft" | "active";
  sort?: ProductSort;
};

const SORT_LABELS: Record<ProductSort, string> = {
  newest: "Newest",
  price_asc: "Price: low → high",
  price_desc: "Price: high → low",
  stock_asc: "Stock: low → high",
  stock_desc: "Stock: high → low",
};

/** Compact pill dropdown; gold when a non-default value is picked. */
const pill = (active: boolean) =>
  cn(
    "select-chevron h-9 shrink-0 rounded-full border bg-ink-900 pr-7 pl-3.5 text-xs transition-colors focus:ring-2 focus:ring-gold-500/15 focus:outline-none",
    active ? "border-gold-500/60 text-gold-300" : "border-ink-600 text-stone",
  );

export function ProductFilters({
  categories,
  initial,
}: {
  categories: { id: string; name: string }[];
  initial: Filters;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(initial.q ?? "");

  function apply(next: Filters) {
    const merged = { ...initial, ...next };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString(); // page resets on any filter change
    startTransition(() =>
      router.replace(`/admin/products${qs ? `?${qs}` : ""}`, { scroll: false }),
    );
  }

  // Debounced search
  useEffect(() => {
    if (q.trim() === (initial.q ?? "")) return;
    const t = setTimeout(() => apply({ q: q.trim() || undefined }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="mb-4 space-y-2">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-mute" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or SKU"
            aria-label="Search products"
            className={cn(inputClass, "pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden")}
          />
          {/* Our own clear button (the browser's one can't be positioned); the spinner takes its place while loading */}
          {pending ? (
            <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-gold-400" />
          ) : (
            q && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQ("");
                  apply({ q: undefined });
                }}
                className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-mute hover:text-ivory"
              >
                <X className="size-4" />
              </button>
            )
          )}
        </div>
        <ViewToggle />
      </div>

      {/* One row; scrolls sideways when it doesn't fit */}
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-none sm:mx-0 sm:px-0">
        <select
          aria-label="Filter by category"
          className={pill(!!initial.category)}
          value={initial.category ?? ""}
          onChange={(e) => apply({ category: e.target.value || undefined })}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          className={pill(!!initial.status)}
          value={initial.status ?? ""}
          onChange={(e) =>
            apply({
              status: (e.target.value || undefined) as Filters["status"],
            })
          }
        >
          <option value="">Any status</option>
          <option value="active">Live</option>
          <option value="draft">Draft</option>
        </select>
        <select
          aria-label="Sort products"
          className={pill(!!initial.sort && initial.sort !== "newest")}
          value={initial.sort ?? "newest"}
          onChange={(e) => {
            const v = e.target.value as ProductSort;
            apply({ sort: v === "newest" ? undefined : v });
          }}
        >
          {(Object.keys(SORT_LABELS) as ProductSort[]).map((k) => (
            <option key={k} value={k}>
              {k === "newest" ? "Sort: Newest" : SORT_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
