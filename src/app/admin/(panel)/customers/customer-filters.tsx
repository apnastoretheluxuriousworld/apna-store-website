"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { inputClass, selectClass } from "@/components/admin/form";
import type { CustomerSort } from "@/lib/data/customers";
import { cn } from "@/lib/utils";

type Filters = { q?: string; sort?: CustomerSort; blocked?: "1" };

const SORTS: { value: CustomerSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "spent", label: "Top spenders" },
  { value: "orders", label: "Most orders" },
  { value: "recent", label: "Recently active" },
];

export function CustomerFilters({ initial }: { initial: Filters }) {
  const router = useRouter();
  const [loading, startTransition] = useTransition();
  const [q, setQ] = useState(initial.q ?? "");

  function apply(next: Filters) {
    const merged = { ...initial, ...next };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "sort" && v === "newest")) params.set(k, String(v));
    const qs = params.toString();
    startTransition(() => router.replace(`/admin/customers${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  useEffect(() => {
    if (q.trim() === (initial.q ?? "")) return;
    const t = setTimeout(() => apply({ q: q.trim() || undefined }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_11rem_10rem]">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-mute" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or mobile number"
          aria-label="Search customers"
          className={cn(inputClass, "pl-10")}
        />
        {loading && <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-gold-400" />}
      </div>
      <select aria-label="Sort customers" className={selectClass} value={initial.sort ?? "newest"} onChange={(e) => apply({ sort: e.target.value as CustomerSort })}>
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <select aria-label="Filter by account status" className={selectClass} value={initial.blocked ?? ""} onChange={(e) => apply({ blocked: e.target.value ? "1" : undefined })}>
        <option value="">All customers</option>
        <option value="1">Blocked only</option>
      </select>
    </div>
  );
}
