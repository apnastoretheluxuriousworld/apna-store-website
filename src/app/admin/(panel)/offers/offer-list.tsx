"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight, Gift } from "lucide-react";
import { Switch } from "@/components/admin/form";
import { SyncBadge, useOutbox, type Job } from "@/components/admin/outbox";
import type { AdminOfferRow } from "@/lib/data/offers";
import { formatIstDay, istDayEnd } from "@/lib/validation/coupon";
import { OFFER_STATUS_LABEL, describeOffer, offerStatus, type OfferStatus } from "@/lib/validation/offer";
import { setOfferActive } from "./actions";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<OfferStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-300",
  scheduled: "bg-sky-500/10 text-sky-300",
  expired: "bg-ink-700 text-mute",
  off: "bg-ink-700 text-mute",
};

const todayIst = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

export function OfferList({ initial }: { initial: AdminOfferRow[] }) {
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
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, isActive, status: offerStatus({ ...r, isActive }, todayIst()) } : r)));
    startTransition(async () => {
      const res = await setOfferActive(id, isActive);
      if (res.ok) toast.success(isActive ? "Offer switched on" : "Offer switched off — it's hidden from the store");
      else {
        setRows(prev);
        toast.error(res.error);
      }
    });
  }

  if (shown.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-ink-600 py-14 text-center">
        <Gift className="size-6 text-gold-500/70" strokeWidth={1.25} />
        <p className="mt-3 text-sm text-stone">No offers yet</p>
        <p className="mt-1 max-w-xs text-xs text-mute">
          Pick products from your store and set a combo price, e.g. any 3 perfumes for ₹1,000. Offers show on the homepage under the Feed.
        </p>
        <Link href="/admin/offers/new" className="mt-3 text-sm text-gold-400 hover:underline">
          Create an offer
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-ink-600/60 overflow-hidden rounded-xl border border-ink-600/70 bg-ink-850">
      {shown.map((row) => (
        <Row key={row.id} row={row} onToggle={toggle} sync={sync.get(row.id)} onServer={serverIds.has(row.id)} />
      ))}
    </ul>
  );
}

function Row({
  row,
  onToggle,
  sync,
  onServer,
}: {
  row: AdminOfferRow;
  onToggle: (id: string, v: boolean) => void;
  sync?: Job["status"];
  onServer: boolean;
}) {
  const facts = [
    `${row.productIds.length} product${row.productIds.length === 1 ? "" : "s"}`,
    row.liveProducts < row.productIds.length && `${row.productIds.length - row.liveProducts} not live`,
    `${row.sold} sold`,
    row.endsOn && `${row.status === "expired" ? "ended" : "till"} ${formatIstDay(istDayEnd(row.endsOn))}`,
  ].filter(Boolean);
  return (
    <li className={cn("flex items-center gap-3 px-3 py-3 sm:px-4", !onServer && "pointer-events-none")} data-testid="offer-row">
      <Link href={`/admin/offers/${row.id}`} className={cn("group flex min-w-0 flex-1 items-center gap-3", row.status !== "active" && "opacity-70")}>
        <span className="relative aspect-4/5 w-11 shrink-0 overflow-hidden rounded-lg border border-gold-500/25 bg-ink-900">
          {row.coverUrl && <Image src={row.coverUrl} alt="" fill sizes="44px" className="object-cover" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm text-ivory group-hover:text-gold-300">{row.title}</span>
            <span className={cn("rounded px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider", STATUS_TONE[row.status])}>
              {OFFER_STATUS_LABEL[row.status]}
            </span>
            {sync && <SyncBadge failed={sync === "failed"} />}
          </span>
          <span className="mt-0.5 block truncate text-xs text-stone">
            {describeOffer({ pickCount: row.pickCount, price: row.price, productCount: row.productIds.length })}
          </span>
          <span className="mt-0.5 block truncate text-xs text-mute">{facts.join(" · ")}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-mute group-hover:text-gold-400" />
      </Link>
      <Switch checked={row.isActive} onChange={(v) => onToggle(row.id, v)} label={`Offer ${row.title} on`} />
    </li>
  );
}

/** Queued (not yet synced) saves/deletes on top of the server rows; new offers go first. */
function overlay(rows: AdminOfferRow[], queue: Job[]) {
  let shown = rows;
  const sync = new Map<string, Job["status"]>();
  const today = todayIst();
  for (const job of queue) {
    if (job.kind === "offer.delete") {
      shown = shown.filter((r) => r.id !== job.entityId);
    } else if (job.kind === "offer.save" && job.preview) {
      const preview = job.preview as Partial<AdminOfferRow>;
      const i = shown.findIndex((r) => r.id === job.entityId);
      const merge = (r: AdminOfferRow) => {
        const next = { ...r, ...preview } as AdminOfferRow;
        return { ...next, status: offerStatus(next, today) };
      };
      shown =
        i >= 0
          ? shown.map((r, j) => (j === i ? merge(r) : r))
          : [merge({ sold: 0, liveProducts: preview.productIds?.length ?? 0, slug: "", status: "active" } as AdminOfferRow), ...shown];
      sync.set(job.entityId, job.status);
    }
  }
  return { shown, sync, serverIds: new Set(rows.map((r) => r.id)) };
}
