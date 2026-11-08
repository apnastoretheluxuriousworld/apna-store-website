"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight, Megaphone } from "lucide-react";
import { Switch } from "@/components/admin/form";
import { SyncBadge, useOutbox, type Job } from "@/components/admin/outbox";
import type { AdminInfluencerRow } from "@/lib/data/coupons";
import { formatPrice } from "@/lib/format";
import { setInfluencerActive } from "./actions";
import { cn } from "@/lib/utils";

export function InfluencerList({ initial }: { initial: AdminInfluencerRow[] }) {
  const [rows, setRows] = useState(initial);
  // Next keeps visited pages mounted: adopt fresh server rows when they arrive.
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setRows(initial);
  }
  const [, startTransition] = useTransition();
  const queue = useOutbox();
  const { shown, sync, serverIds } = useMemo(() => overlay(rows, queue), [rows, queue]);

  function toggle(id: string, isActive: boolean) {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, isActive } : r)));
    startTransition(async () => {
      const res = await setInfluencerActive(id, isActive);
      if (res.ok) toast.success(isActive ? "Switched on — their codes work again" : "Switched off — their codes stop working");
      else {
        setRows(prev);
        toast.error(res.error);
      }
    });
  }

  if (shown.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-ink-600 py-14 text-center">
        <Megaphone className="size-6 text-gold-500/70" strokeWidth={1.25} />
        <p className="mt-3 text-sm text-stone">No influencers yet</p>
        <p className="mt-1 max-w-xs text-xs text-mute">Add the people who promote the store, then give each one a coupon code to track their sales.</p>
        <Link href="/admin/influencers/new" className="mt-3 text-sm text-gold-400 hover:underline">
          Add an influencer
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-ink-600/60 overflow-hidden rounded-xl border border-ink-600/70 bg-ink-850">
      {shown.map((row) => (
        <li key={row.id} className={cn("flex items-center gap-3 px-3 py-3 sm:px-4", !serverIds.has(row.id) && "pointer-events-none")}>
          <Link href={`/admin/influencers/${row.id}`} className={cn("group flex min-w-0 flex-1 items-center gap-3", !row.isActive && "opacity-60")}>
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-gold-500/25 bg-gold-500/5 font-serif text-lg text-gold-300">
              {row.name.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm text-ivory group-hover:text-gold-300">{row.name}</span>
                {row.handle && <span className="truncate text-xs text-mute">@{row.handle}</span>}
                {!row.isActive && <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-mute">Off</span>}
                {sync.get(row.id) && <SyncBadge failed={sync.get(row.id) === "failed"} />}
              </span>
              <span className="mt-0.5 block truncate font-mono text-xs tracking-wider text-stone">
                {row.codes.length ? row.codes.join(" · ") : <span className="font-sans tracking-normal text-mute">No coupon yet</span>}
              </span>
              <span className="mt-0.5 block truncate text-xs text-mute">
                {row.orders} order{row.orders === 1 ? "" : "s"} · {formatPrice(row.sales)} sales
                {row.commissionPercent > 0 && ` · ${formatPrice(row.earned)} earned`}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-mute group-hover:text-gold-400" />
          </Link>
          <Switch checked={row.isActive} onChange={(v) => toggle(row.id, v)} label={`${row.name} on`} />
        </li>
      ))}
    </ul>
  );
}

/** Queued (not yet synced) saves/deletes on top of the server rows; new ones go first. */
function overlay(rows: AdminInfluencerRow[], queue: Job[]) {
  let shown = rows;
  const sync = new Map<string, Job["status"]>();
  for (const job of queue) {
    if (job.kind === "influencer.delete") {
      shown = shown.filter((r) => r.id !== job.entityId);
    } else if (job.kind === "influencer.save" && job.preview) {
      const preview = job.preview as Partial<AdminInfluencerRow>;
      const i = shown.findIndex((r) => r.id === job.entityId);
      const blank = { codes: [], orders: 0, sales: 0, discount: 0, earned: 0, pending: 0 };
      shown = i >= 0 ? shown.map((r, j) => (j === i ? { ...r, ...preview } : r)) : [{ ...blank, ...preview } as AdminInfluencerRow, ...shown];
      sync.set(job.entityId, job.status);
    }
  }
  return { shown, sync, serverIds: new Set(rows.map((r) => r.id)) };
}
