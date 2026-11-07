"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { inputClass, selectClass } from "@/components/admin/form";
import type { ReviewStatus } from "@/lib/validation/review";
import { cn } from "@/lib/utils";

type Filters = { status?: ReviewStatus; q?: string; rating?: number; media?: "with" };

export function ReviewFilters({ initial, pending: pendingCount, published }: { initial: Filters; pending: number; published: number }) {
  const router = useRouter();
  const [loading, startTransition] = useTransition();
  const [q, setQ] = useState(initial.q ?? "");

  function apply(next: Filters) {
    const merged = { ...initial, ...next };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, String(v));
    const qs = params.toString(); // page resets on any filter change
    startTransition(() => router.replace(`/admin/reviews${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  useEffect(() => {
    if (q.trim() === (initial.q ?? "")) return;
    const t = setTimeout(() => apply({ q: q.trim() || undefined }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const tabs: { value?: ReviewStatus; label: string; count?: number }[] = [
    { value: "pending", label: "Pending", count: pendingCount },
    { value: "published", label: "Published", count: published },
    { label: "All", count: pendingCount + published },
  ];

  return (
    <div className="mb-4 space-y-2">
      <div role="tablist" aria-label="Review status" className="flex gap-1 overflow-x-auto rounded-lg border border-ink-600 bg-ink-900 p-1 scrollbar-none sm:inline-flex">
        {tabs.map((t) => {
          const active = initial.status === t.value;
          return (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => apply({ status: t.value })}
              className={cn(
                "flex h-9 flex-1 items-center justify-center gap-2 rounded-md px-4 text-xs uppercase tracking-[0.16em] whitespace-nowrap transition-colors sm:flex-none",
                active ? "bg-gold font-semibold text-ink-950" : "text-mute hover:text-ivory",
              )}
            >
              {t.label}
              <span className={cn("tabular-nums", active ? "text-ink-950/70" : t.value === "pending" && t.count ? "text-gold-400" : "text-mute")}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_10rem_12rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-mute" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search client, product or text"
            aria-label="Search reviews"
            className={cn(inputClass, "pl-10")}
          />
          {loading && <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-gold-400" />}
        </div>
        <select
          aria-label="Filter by rating"
          className={selectClass}
          value={initial.rating ?? ""}
          onChange={(e) => apply({ rating: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">Any rating</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} star{n > 1 ? "s" : ""}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by photos and videos"
          className={selectClass}
          value={initial.media ?? ""}
          onChange={(e) => apply({ media: e.target.value ? "with" : undefined })}
        >
          <option value="">Any media</option>
          <option value="with">With photos/videos</option>
        </select>
      </div>
    </div>
  );
}
