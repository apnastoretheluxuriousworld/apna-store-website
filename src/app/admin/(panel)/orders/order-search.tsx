"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { inputClass } from "@/components/admin/form";
import { cn } from "@/lib/utils";

export function OrderSearch({ tab, initial }: { tab: string; initial?: string }) {
  const router = useRouter();
  const [loading, startTransition] = useTransition();
  const [q, setQ] = useState(initial ?? "");

  useEffect(() => {
    if (q.trim() === (initial ?? "")) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (tab !== "all") params.set("tab", tab);
      if (q.trim()) params.set("q", q.trim());
      const qs = params.toString();
      startTransition(() => router.replace(`/admin/orders${qs ? `?${qs}` : ""}`, { scroll: false }));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="relative mb-4">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-mute" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search order no., name, mobile or UPI transaction ID"
        aria-label="Search orders"
        className={cn(inputClass, "pl-10")}
      />
      {loading && <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-gold-400" />}
    </div>
  );
}
