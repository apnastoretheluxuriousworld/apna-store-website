"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight, TicketPercent } from "lucide-react";
import { Switch } from "@/components/admin/form";
import { SyncBadge, useOutbox, type Job } from "@/components/admin/outbox";
import type { AdminCouponRow } from "@/lib/data/coupons";
import { formatPrice } from "@/lib/format";
import { COUPON_STATUS_LABEL, describeCoupon, formatIstDay, istDayEnd, type CouponStatus } from "@/lib/validation/coupon";
import { setCouponActive } from "./actions";
import { cn } from "@/lib/utils";

export const STATUS_TONE: Record<CouponStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-300",
  scheduled: "bg-sky-500/10 text-sky-300",
  expired: "bg-ink-700 text-mute",
  used_up: "bg-amber-500/10 text-amber-200",
  off: "bg-ink-700 text-mute",
};

export function StatusPill({ status }: { status: CouponStatus }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider", STATUS_TONE[status])}>{COUPON_STATUS_LABEL[status]}</span>
  );
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "scheduled", label: "Scheduled" },
  { key: "ended", label: "Ended / off" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

const matches = (f: Filter, s: CouponStatus) =>
  f === "all" || (f === "ended" ? s === "expired" || s === "used_up" || s === "off" : s === f);

export function CouponList({ initial, emptyHref = "/admin/coupons/new" }: { initial: AdminCouponRow[]; emptyHref?: string }) {
  const [rows, setRows] = useState(initial);
  // Next keeps visited pages mounted: adopt fresh server rows when they arrive.
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setRows(initial);
  }
  const [filter, setFilter] = useState<Filter>("all");
  const [, startTransition] = useTransition();
  const queue = useOutbox();
  const { shown, sync, serverIds } = useMemo(() => overlay(rows, queue), [rows, queue]);
  const visible = shown.filter((r) => matches(filter, r.status));

  function toggle(id: string, isActive: boolean) {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, isActive, status: isActive ? statusOn(r) : "off" } : r)));
    startTransition(async () => {
      const res = await setCouponActive(id, isActive);
      if (res.ok) toast.success(isActive ? "Coupon switched on" : "Coupon switched off — customers can't use it");
      else {
        setRows(prev);
        toast.error(res.error);
      }
    });
  }

  if (shown.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-ink-600 py-14 text-center">
        <TicketPercent className="size-6 text-gold-500/70" strokeWidth={1.25} />
        <p className="mt-3 text-sm text-stone">No coupons yet</p>
        <p className="mt-1 max-w-xs text-xs text-mute">Create a code for an influencer, a festive sale or a first-order welcome offer.</p>
        <Link href={emptyHref} className="mt-3 text-sm text-gold-400 hover:underline">
          Create a coupon
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {shown.length > 4 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Filter coupons">
          {FILTERS.map((f) => {
            const n = shown.filter((r) => matches(f.key, r.status)).length;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "h-8 shrink-0 rounded-full border px-3 text-xs",
                  filter === f.key ? "border-gold-500/60 bg-gold-500/10 text-gold-300" : "border-ink-600 text-stone hover:text-ivory",
                )}
              >
                {f.label} <span className="text-mute">{n}</span>
              </button>
            );
          })}
        </div>
      )}
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-600 py-10 text-center text-sm text-mute">Nothing here.</p>
      ) : (
        <ul className="divide-y divide-ink-600/60 overflow-hidden rounded-xl border border-ink-600/70 bg-ink-850">
          {visible.map((row) => (
            <Row key={row.id} row={row} onToggle={toggle} sync={sync.get(row.id)} onServer={serverIds.has(row.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({
  row,
  onToggle,
  sync,
  onServer,
}: {
  row: AdminCouponRow;
  onToggle: (id: string, v: boolean) => void;
  sync?: Job["status"];
  onServer: boolean;
}) {
  const facts = [
    row.influencerName,
    `${row.uses}${row.maxUses != null ? `/${row.maxUses}` : ""} used`,
    row.sales > 0 && `${formatPrice(row.sales)} sales`,
    row.endsOn && `${row.status === "expired" ? "ended" : "till"} ${formatIstDay(istDayEnd(row.endsOn))}`,
  ].filter(Boolean);
  return (
    <li className={cn("flex items-center gap-3 px-3 py-3 sm:px-4", !onServer && "pointer-events-none")} data-testid="coupon-row">
      <Link href={`/admin/coupons/${row.id}`} className={cn("group flex min-w-0 flex-1 items-center gap-3", row.status !== "active" && "opacity-70")}>
        <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-gold-500/25 bg-gold-500/5 text-[0.7rem] font-medium text-gold-300 tabular-nums">
          {row.type === "percent" ? `${row.value}%` : "₹"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-mono text-sm tracking-wider text-ivory group-hover:text-gold-300">{row.code}</span>
            <StatusPill status={row.status} />
            {sync && <SyncBadge failed={sync === "failed"} />}
          </span>
          <span className="mt-0.5 block truncate text-xs text-stone">{describeCoupon(row)}</span>
          <span className="mt-0.5 block truncate text-xs text-mute">{facts.join(" · ")}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-mute group-hover:text-gold-400" />
      </Link>
      <Switch checked={row.isActive} onChange={(v) => onToggle(row.id, v)} label={`Coupon ${row.code} on`} />
    </li>
  );
}

/** Status once switched on (dates and limits still apply). */
function statusOn(r: AdminCouponRow): CouponStatus {
  if (r.influencerOff) return "off";
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  if (r.endsOn && r.endsOn < today) return "expired";
  if (r.startsOn && r.startsOn > today) return "scheduled";
  if (r.maxUses != null && r.uses >= r.maxUses) return "used_up";
  return "active";
}

/** Queued (not yet synced) saves/deletes on top of the server rows; new coupons go first. */
function overlay(rows: AdminCouponRow[], queue: Job[]) {
  let shown = rows;
  const sync = new Map<string, Job["status"]>();
  for (const job of queue) {
    if (job.kind === "coupon.delete") {
      shown = shown.filter((r) => r.id !== job.entityId);
    } else if (job.kind === "coupon.save" && job.preview) {
      const preview = job.preview as Partial<AdminCouponRow>;
      const i = shown.findIndex((r) => r.id === job.entityId);
      const merge = (r: AdminCouponRow) => {
        const next = { ...r, ...preview } as AdminCouponRow;
        return { ...next, status: next.isActive ? statusOn(next) : ("off" as const) };
      };
      shown =
        i >= 0
          ? shown.map((r, j) => (j === i ? merge(r) : r))
          : [merge({ uses: 0, sales: 0, discountGiven: 0, influencerOff: false, status: "active" } as AdminCouponRow), ...shown];
      sync.set(job.entityId, job.status);
    }
  }
  return { shown, sync, serverIds: new Set(rows.map((r) => r.id)) };
}
