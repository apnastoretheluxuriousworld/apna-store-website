"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { CategoryIcon } from "@/components/brand/category-icon";
import { ProductCard } from "@/components/product/product-card";
import type { NavCategory } from "@/lib/site";
import { cleanQuery, type SearchResult } from "@/lib/search";
import { cn } from "@/lib/utils";

/** Answers already fetched this visit (typing back over a word is instant). */
const memo = new Map<string, SearchResult>();

/**
 * Live search: results are fetched from /api/search as you type and swapped in
 * place — the page itself never reloads. ?q= is kept in the address bar (without
 * a navigation) so refresh, back and shared links show the same results.
 */
export function SearchView({ categories }: { categories: NavCategory[] }) {
  // ?q= is only known in the browser (the page shell is static), hence the boundary.
  return (
    <Suspense fallback={<LiveSearch categories={categories} initialQ="" />}>
      <WithQuery categories={categories} />
    </Suspense>
  );
}

function WithQuery({ categories }: { categories: NavCategory[] }) {
  const q = cleanQuery(useSearchParams().get("q"));
  const [initialQ] = useState(q); // later ?q= changes come from this component itself
  return <LiveSearch categories={categories} initialQ={initialQ} />;
}

function LiveSearch({ categories, initialQ }: { categories: NavCategory[]; initialQ: string }) {
  const [value, setValue] = useState(initialQ);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inflight = useRef<AbortController>(undefined);

  async function run(raw: string) {
    const q = cleanQuery(raw);
    const url = q ? `/search?q=${encodeURIComponent(q)}` : "/search";
    if (location.pathname + location.search !== url) history.replaceState(history.state, "", url);
    inflight.current?.abort();
    if (!q) {
      setResult(null);
      setLoading(false);
      return;
    }
    const cached = memo.get(q);
    if (cached) {
      setResult(cached);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    inflight.current = ctrl;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as SearchResult;
      memo.set(q, data);
      setResult(data);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setResult({ q, collections: [], products: [] });
    } finally {
      if (inflight.current === ctrl) setLoading(false);
    }
  }

  function schedule(raw: string, delay = 220) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(raw), delay);
  }

  // Start from ?q= (refresh, back, shared link); stop pending work on leave.
  useEffect(() => {
    if (initialQ) schedule(initialQ, 0);
    return () => {
      clearTimeout(timer.current);
      inflight.current?.abort();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, on mount

  const q = cleanQuery(value);
  const showing = q ? result : null;
  const empty = showing && !showing.collections.length && !showing.products.length;

  return (
    <>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          input.current?.blur(); // hide the phone keyboard to show results
          schedule(value, 0);
        }}
        className="relative mx-auto max-w-2xl"
      >
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-gold-500" strokeWidth={1.5} />
        <input
          ref={input}
          type="search"
          value={value}
          autoFocus
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Search watches, perfumes, brands…"
          aria-label="Search products and collections"
          onChange={(e) => {
            setValue(e.target.value);
            schedule(e.target.value);
          }}
          className="h-14 w-full rounded-full border border-gold-500/40 bg-ink-900/80 pr-12 pl-12 text-base text-ivory placeholder:text-mute focus:border-gold-400 focus:ring-2 focus:ring-gold-500/20 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <span className="absolute top-1/2 right-3 -translate-y-1/2">
          {loading ? (
            <Loader2 className="m-2 size-4 animate-spin text-gold-400" aria-label="Searching" />
          ) : (
            value && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setValue("");
                  schedule("", 0);
                  input.current?.focus();
                }}
                className="grid size-8 place-items-center rounded-full text-stone hover:text-gold-300"
              >
                <X className="size-4" />
              </button>
            )
          )}
        </span>
      </form>

      <div aria-live="polite" className={cn("transition-opacity duration-200", loading && showing && "opacity-60")}>
        {!q || (!showing && loading) ? (
          !q && <Browse categories={categories} title="Browse collections" />
        ) : empty ? (
          <>
            <div className="mx-auto mt-12 max-w-md text-center">
              <p className="font-serif text-2xl text-ivory">Nothing for “{showing.q}”</p>
              <p className="mt-2 text-sm text-stone">Try a brand, a collection or a simpler word.</p>
            </div>
            <Browse categories={categories} title="Or explore" />
          </>
        ) : (
          showing && (
            <div className="mt-8 lg:mt-12">
              {showing.collections.length > 0 && (
                <section className="mb-8">
                  <h2 className="mb-3 text-[0.65rem] uppercase tracking-[0.25em] text-gold-500">Collections</h2>
                  <CollectionChips categories={showing.collections} />
                </section>
              )}
              {showing.products.length > 0 && (
                <section>
                  <h2 className="mb-3 text-[0.65rem] uppercase tracking-[0.25em] text-gold-500">
                    {showing.products.length} {showing.products.length === 1 ? "piece" : "pieces"}
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4 xl:grid-cols-6">
                    {showing.products.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )
        )}
      </div>
    </>
  );
}

function Browse({ categories, title }: { categories: NavCategory[]; title: string }) {
  return (
    <div className="mt-10 lg:mt-14">
      <h2 className="mb-4 text-center text-[0.65rem] uppercase tracking-[0.25em] text-gold-500">{title}</h2>
      <CollectionChips categories={categories} center />
    </div>
  );
}

function CollectionChips({ categories, center }: { categories: NavCategory[]; center?: boolean }) {
  return (
    <div className={cn("flex flex-wrap gap-2.5", center && "justify-center")}>
      {categories.map((c) => (
        <Link
          key={c.slug}
          href={`/shop/${c.slug}`}
          className="group flex items-center gap-2.5 rounded-full border border-gold-500/30 bg-ink-850/60 py-1.5 pr-4 pl-1.5 transition-colors hover:border-gold-400"
        >
          <span className="relative grid size-9 place-items-center overflow-hidden rounded-full bg-ink-800">
            {c.imageUrl ? (
              <Image src={c.imageUrl} alt="" fill sizes="36px" className="object-cover" />
            ) : (
              <CategoryIcon slug={c.slug} className="size-4 text-gold-400" strokeWidth={1.25} />
            )}
          </span>
          <span className="text-sm text-ivory/90 group-hover:text-gold-300">{c.name}</span>
        </Link>
      ))}
    </div>
  );
}
