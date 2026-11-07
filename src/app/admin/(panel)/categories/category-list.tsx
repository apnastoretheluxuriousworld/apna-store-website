"use client";

import Image from "next/image";
import { IntentLink } from "@/components/admin/intent-link";
import { useId, useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, GripVertical } from "lucide-react";
import { CategoryIcon } from "@/components/brand/category-icon";
import { Switch } from "@/components/admin/form";
import { reorderCategories, setCategoryActive } from "./actions";
import type { AdminCategoryRow } from "@/lib/data/categories";
import { cn } from "@/lib/utils";
import { SyncBadge, useOutbox, type Job } from "@/components/admin/outbox";

export function CategoryList({ initial }: { initial: AdminCategoryRow[] }) {
  const [rows, setRows] = useState(initial);
  // Next keeps visited pages mounted, so this component outlives a visit. When
  // the server sends fresh rows (after an action, or once the cached page goes
  // stale), adopt them instead of keeping the old local copy.
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setRows(initial);
  }
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(rows);
  const queue = useOutbox();
  const { shown, sync, serverIds } = useMemo(() => overlay(optimistic, queue), [optimistic, queue]);

  // SSR-stable id for dnd-kit's aria-describedby (its own counter differs between server and browser → hydration mismatch).
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
    if (from < 0 || to < 0) return; // a category that hasn't synced yet
    const next = arrayMove(rows, from, to);
    const prev = rows;
    setRows(next);
    startTransition(async () => {
      const res = await reorderCategories(next.map((r) => r.id));
      if (res.ok) toast.success("Order saved — the store menu follows this order");
      else {
        setRows(prev);
        toast.error(res.error);
      }
    });
  }

  function toggle(id: string, isActive: boolean) {
    startTransition(async () => {
      setOptimistic(rows.map((r) => (r.id === id ? { ...r, isActive } : r)));
      const res = await setCategoryActive(id, isActive);
      if (res.ok) {
        setRows((rs) => rs.map((r) => (r.id === id ? { ...r, isActive } : r)));
        toast.success(isActive ? "Visible in store" : "Hidden from store");
      } else toast.error(res.error);
    });
  }

  if (!shown.length) {
    return (
      <div className="rounded-xl border border-dashed border-ink-600 py-16 text-center text-sm text-mute">
        No categories yet.
      </div>
    );
  }

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
      <SortableContext items={shown.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <ul className="divide-y divide-ink-600/60 overflow-hidden rounded-xl border border-ink-600/70 bg-ink-850">
          {shown.map((row) => (
            <Row key={row.id} row={row} onToggle={toggle} sync={sync.get(row.id)} onServer={serverIds.has(row.id)} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function Row({
  row,
  onToggle,
  sync,
  onServer,
}: {
  row: AdminCategoryRow;
  onToggle: (id: string, v: boolean) => void;
  sync?: Job["status"];
  onServer: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });

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
        aria-label={`Drag to reorder ${row.name}`}
        className="flex h-10 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-mute hover:text-gold-400 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>

      <IntentLink href={`/admin/categories/${row.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
        <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-ink-600 bg-ink-900">
          {row.imageUrl ? (
            <Image src={row.imageUrl} alt="" fill sizes="48px" unoptimized className="object-cover" />
          ) : (
            <CategoryIcon slug={row.slug} className="size-5 text-gold-400" strokeWidth={1.25} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm text-ivory group-hover:text-gold-300">{row.name}</span>
            {!row.isActive && (
              <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-mute">Hidden</span>
            )}
            {sync === "failed" && <SyncBadge failed />}
          </span>
          <span className="mt-0.5 block truncate text-xs text-mute">
            {row.productCount} {row.productCount === 1 ? "product" : "products"}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-mute group-hover:text-gold-400" />
      </IntentLink>

      <Switch checked={row.isActive} onChange={(v) => onToggle(row.id, v)} label={`Show ${row.name} in store`} />
    </li>
  );
}

/** Queued (not yet synced) saves/deletes applied on top of the server rows; new ones go last. */
function overlay(rows: AdminCategoryRow[], queue: Job[]) {
  let shown = rows;
  const sync = new Map<string, Job["status"]>();
  for (const job of queue) {
    if (job.kind === "category.delete") {
      shown = shown.filter((r) => r.id !== job.entityId);
    } else if (job.kind === "category.save" && job.preview) {
      const preview = job.preview as Partial<AdminCategoryRow>;
      const i = shown.findIndex((r) => r.id === job.entityId);
      shown = i >= 0 ? shown.map((r, j) => (j === i ? { ...r, ...preview } : r)) : [...shown, preview as AdminCategoryRow];
      sync.set(job.entityId, job.status);
    }
  }
  return { shown, sync, serverIds: new Set(rows.map((r) => r.id)) };
}
