"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, GalleryHorizontal, GripVertical } from "lucide-react";
import { Switch } from "@/components/admin/form";
import { SyncBadge, useOutbox, type Job } from "@/components/admin/outbox";
import type { AdminHeroRow } from "@/lib/data/hero";
import { reorderHeroSlides, setHeroSlideActive } from "./actions";
import { cn } from "@/lib/utils";

export function HeroSlideList({ initial }: { initial: AdminHeroRow[] }) {
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

  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = rows.findIndex((r) => r.id === e.active.id);
    const to = rows.findIndex((r) => r.id === e.over!.id);
    if (from < 0 || to < 0) return; // a banner that hasn't synced yet
    const next = arrayMove(rows, from, to);
    const prev = rows;
    setRows(next);
    startTransition(async () => {
      const res = await reorderHeroSlides(next.map((r) => r.id));
      if (res.ok) toast.success("Order saved — the homepage follows this order");
      else {
        setRows(prev);
        toast.error(res.error);
      }
    });
  }

  function toggle(id: string, isActive: boolean) {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, isActive } : r)));
    startTransition(async () => {
      const res = await setHeroSlideActive(id, isActive);
      if (res.ok) toast.success(isActive ? "Shown on the homepage" : "Hidden from the homepage");
      else {
        setRows(prev);
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-3 lg:space-y-5">
      {shown.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-ink-600 py-14 text-center">
          <GalleryHorizontal className="size-6 text-gold-500/70" strokeWidth={1.25} />
          <p className="mt-3 text-sm text-stone">No banners yet</p>
          <p className="mt-1 max-w-xs text-xs text-mute">Add one for an offer, a new arrival or a festive sale.</p>
          <Link href="/admin/hero/new" className="mt-3 text-sm text-gold-400 hover:underline">
            Add your first banner
          </Link>
        </div>
      ) : (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
          <SortableContext items={shown.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-ink-600/60 overflow-hidden rounded-xl border border-ink-600/70 bg-ink-850">
              {shown.map((row) => (
                <Row key={row.id} row={row} onToggle={toggle} sync={sync.get(row.id)} onServer={serverIds.has(row.id)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function headline(r: AdminHeroRow) {
  return [r.title, r.highlight].filter(Boolean).join(" ") || "Untitled banner";
}

function Row({
  row,
  onToggle,
  sync,
  onServer,
}: {
  row: AdminHeroRow;
  onToggle: (id: string, v: boolean) => void;
  sync?: Job["status"];
  onServer: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const label = headline(row);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 bg-ink-850 px-3 py-3 sm:px-4",
        isDragging && "relative z-10 shadow-2xl ring-1 ring-gold-500/40",
        !onServer && "pointer-events-none",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${label}`}
        className="flex h-10 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-mute hover:text-gold-400 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>

      <Link href={`/admin/hero/${row.id}`} className={cn("group flex min-w-0 flex-1 items-center gap-3", !row.isActive && "opacity-60")}>
        <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg border border-ink-600 bg-ink-900">
          <Image src={row.imageUrl} alt="" fill sizes="48px" unoptimized className="object-cover" />
        </span>
        <span className="min-w-0 flex-1">
          {row.eyebrow && <span className="block truncate text-[0.6rem] uppercase tracking-[0.2em] text-gold-500">{row.eyebrow}</span>}
          <span className="flex items-center gap-2">
            <span className="truncate text-sm text-ivory group-hover:text-gold-300">{label}</span>
            {!row.isActive && <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-mute">Hidden</span>}
            {sync && <SyncBadge failed={sync === "failed"} />}
          </span>
          {row.ctaHref && (
            <span className="mt-0.5 block truncate text-xs text-mute">
              {row.ctaLabel || "Shop now"} → {row.ctaHref}
            </span>
          )}
        </span>
        <ChevronRight className="size-4 shrink-0 text-mute group-hover:text-gold-400" />
      </Link>

      <Switch checked={row.isActive} onChange={(v) => onToggle(row.id, v)} label={`Show ${label} on the homepage`} />
    </li>
  );
}

/** Queued (not yet synced) saves/deletes on top of the server rows; new banners go first. */
function overlay(rows: AdminHeroRow[], queue: Job[]) {
  let shown = rows;
  const sync = new Map<string, Job["status"]>();
  for (const job of queue) {
    if (job.kind === "hero.delete") {
      shown = shown.filter((r) => r.id !== job.entityId);
    } else if (job.kind === "hero.save" && job.preview) {
      const preview = job.preview as Partial<AdminHeroRow>;
      const i = shown.findIndex((r) => r.id === job.entityId);
      shown = i >= 0 ? shown.map((r, j) => (j === i ? { ...r, ...preview } : r)) : [preview as AdminHeroRow, ...shown];
      sync.set(job.entityId, job.status);
    }
  }
  return { shown, sync, serverIds: new Set(rows.map((r) => r.id)) };
}
