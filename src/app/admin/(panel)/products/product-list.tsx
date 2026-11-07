"use client";

import Image from "next/image";
import { IntentLink } from "@/components/admin/intent-link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ImageOff, Star } from "lucide-react";
import { Switch } from "@/components/admin/form";
import type { AdminProductRow } from "@/lib/data/products";
import { formatPrice } from "@/lib/format";
import { setProductFeatured, setProductStatus } from "./actions";
import { cn } from "@/lib/utils";
import { useProductsView } from "./view-toggle";
import { SyncBadge, useOutbox, type Job } from "@/components/admin/outbox";

const LOW_STOCK = 2;

export function ProductList({ initial }: { initial: AdminProductRow[] }) {
  const [rows, setRows] = useState(initial);
  // This component outlives a visit (Next keeps pages mounted), so when the server
  // sends fresh rows (after a save syncs, or a refresh) adopt them — otherwise edits
  // like price, stock or "track stock" kept showing the old copy.
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setRows(initial);
  }
  const [, startTransition] = useTransition();

  function patch(id: string, change: Partial<AdminProductRow>, action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));
    startTransition(async () => {
      const res = await action();
      if (res.ok) toast.success(success);
      else {
        setRows(prev);
        toast.error(res.error ?? "Something went wrong");
      }
    });
  }

  const view = useProductsView();
  const queue = useOutbox();
  const { shown, sync, serverIds } = useMemo(() => overlay(rows, queue), [rows, queue]);

  const toggleFeatured = (p: AdminProductRow) =>
    patch(
      p.id,
      { isFeatured: !p.isFeatured },
      () => setProductFeatured(p.id, !p.isFeatured),
      p.isFeatured ? "Removed from featured" : "Featured on homepage",
    );
  const setLive = (p: AdminProductRow, v: boolean) =>
    patch(p.id, { status: v ? "active" : "draft" }, () => setProductStatus(p.id, v ? "active" : "draft"), v ? "Live in store" : "Moved to draft");

  if (view === "grid") {
    return (
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {shown.map((p) => {
          const live = p.status === "active";
          const onServer = serverIds.has(p.id);
          return (
            <li key={p.id} className="relative flex flex-col overflow-hidden rounded-xl border border-ink-600/70 bg-ink-850">
              {sync.get(p.id) === "failed" && <SyncBadge failed className="absolute top-2 right-2 z-10 bg-ink-950/80" />}
              <IntentLink
                href={`/admin/products/${p.id}`}
                className={cn("group relative block aspect-4/5 bg-ink-900", !onServer && "pointer-events-none")}
              >
                {p.imageUrl ? (
                  <Image src={p.imageUrl} alt="" fill sizes="(min-width: 1024px) 20vw, 50vw" unoptimized className="object-cover" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center">
                    <ImageOff className="size-6 text-mute" strokeWidth={1.25} />
                  </span>
                )}
                {!live && (
                  <span className="absolute top-2 left-2 rounded bg-ink-950/80 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-mute">Draft</span>
                )}
              </IntentLink>
              <div className={cn("flex flex-1 flex-col p-2.5", !onServer && "pointer-events-none")}>
                <IntentLink href={`/admin/products/${p.id}`} className="truncate text-sm text-ivory hover:text-gold-300">
                  {p.name}
                </IntentLink>
                <span className="truncate text-[0.7rem] text-mute">{p.categoryName}</span>
                <span className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs tabular-nums">
                  <span className="text-gold-300">{formatPrice(p.price)}</span>
                  <StockLabel p={p} />
                </span>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <FeatureButton p={p} onClick={() => toggleFeatured(p)} />
                  <Switch checked={live} onChange={(v) => setLive(p, v)} label={`${p.name} live in store`} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="divide-y divide-ink-600/60 overflow-hidden rounded-xl border border-ink-600/70 bg-ink-850">
      {shown.map((p) => {
        const live = p.status === "active";
        const onServer = serverIds.has(p.id);
        return (
          <li key={p.id} className={cn("flex items-center gap-3 px-3 py-3 sm:px-4", !onServer && "pointer-events-none")}>
            <IntentLink href={`/admin/products/${p.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
              <span className="relative grid h-15 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-ink-600 bg-ink-900">
                {p.imageUrl ? (
                  <Image src={p.imageUrl} alt="" fill sizes="48px" unoptimized className="object-cover" />
                ) : (
                  <ImageOff className="size-4 text-mute" strokeWidth={1.25} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm text-ivory group-hover:text-gold-300">{p.name}</span>
                  {!live && <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-mute">Draft</span>}
                  {sync.get(p.id) === "failed" && <SyncBadge failed />}
                </span>
                <span className="mt-0.5 block truncate text-xs text-mute">
                  {p.categoryName}
                  {p.sku && <> · {p.sku}</>}
                  {p.variantCount > 0 && <> · {p.variantCount} variants</>}
                </span>
                <span className="mt-1 flex items-center gap-3 text-xs tabular-nums">
                  <span className="text-gold-300">{formatPrice(p.price)}</span>
                  {p.compareAtPrice && <s className="text-mute">{formatPrice(p.compareAtPrice)}</s>}
                  <StockLabel p={p} />
                </span>
              </span>
            </IntentLink>

            <FeatureButton p={p} onClick={() => toggleFeatured(p)} />
            <div className="flex shrink-0 flex-col items-center gap-1">
              <Switch
                checked={live}
                onChange={(v) => setLive(p, v)}
                label={`${p.name} live in store`}
              />
              <span className="text-[0.55rem] uppercase tracking-wider text-mute">{live ? "Live" : "Off"}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function FeatureButton({ p, onClick }: { p: AdminProductRow; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={p.isFeatured ? `Remove ${p.name} from featured` : `Feature ${p.name}`}
      aria-pressed={p.isFeatured}
      title={p.isFeatured ? "Featured on homepage" : "Feature on homepage"}
      onClick={onClick}
      className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-ink-800"
    >
      <Star className={cn("size-4", p.isFeatured ? "fill-gold-400 text-gold-400" : "text-mute")} strokeWidth={1.5} />
    </button>
  );
}

/**
 * Apply queued (not yet synced) saves and deletes on top of the server rows, so
 * the list reflects the admin's changes at once. New products not on the server
 * yet are shown first and can't be opened until they sync.
 */
function overlay(rows: AdminProductRow[], queue: Job[]) {
  let shown = rows;
  const sync = new Map<string, Job["status"]>();
  for (const job of queue) {
    if (job.kind === "product.delete") {
      shown = shown.filter((r) => r.id !== job.entityId);
    } else if (job.kind === "product.save" && job.preview) {
      const preview = job.preview as Partial<AdminProductRow>;
      const i = shown.findIndex((r) => r.id === job.entityId);
      shown =
        i >= 0
          ? shown.map((r, j) => (j === i ? { ...r, ...preview } : r))
          : [preview as AdminProductRow, ...shown];
      sync.set(job.entityId, job.status);
    }
  }
  return { shown, sync, serverIds: new Set(rows.map((r) => r.id)) };
}

function StockLabel({ p }: { p: AdminProductRow }) {
  if (!p.trackStock) return null; // stock isn't counted for this product
  return (
    <span className={cn(p.stock === 0 ? "text-red-400" : p.stock <= LOW_STOCK ? "text-amber-400" : "text-stone")}>
      {p.stock === 0 ? "Out of stock" : `${p.stock} in stock`}
    </span>
  );
}
