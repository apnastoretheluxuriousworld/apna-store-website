"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, GripVertical, Quote } from "lucide-react";
import { Switch } from "@/components/admin/form";
import { MediaThumb } from "@/components/reviews/media-viewer";
import { Stars } from "@/components/reviews/stars";
import type { AdminTestimonialRow } from "@/lib/data/testimonials";
import { reorderTestimonials, setTestimonialActive } from "./actions";
import { cn } from "@/lib/utils";

export function TestimonialList({ initial }: { initial: AdminTestimonialRow[] }) {
  const [rows, setRows] = useState(initial);
  // Next keeps visited pages mounted: adopt fresh server rows when they arrive.
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setRows(initial);
  }
  const [, startTransition] = useTransition();

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
    const next = arrayMove(rows, from, to);
    const prev = rows;
    setRows(next);
    startTransition(async () => {
      const res = await reorderTestimonials(next.map((r) => r.id));
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
      const res = await setTestimonialActive(id, isActive);
      if (res.ok) toast.success(isActive ? "Shown on the homepage" : "Hidden from the homepage");
      else {
        setRows(prev);
        toast.error(res.error);
      }
    });
  }

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
      <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <ul className="divide-y divide-ink-600/60 overflow-hidden rounded-xl border border-ink-600/70 bg-ink-850">
          {rows.map((row) => (
            <Row key={row.id} row={row} onToggle={toggle} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function Row({ row, onToggle }: { row: AdminTestimonialRow; onToggle: (id: string, v: boolean) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex items-center gap-3 bg-ink-850 px-3 py-3 sm:px-4", isDragging && "relative z-10 shadow-2xl ring-1 ring-gold-500/40")}
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

      <Link href={`/admin/testimonials/${row.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
        {row.media ? (
          <MediaThumb item={row.media} sizes="48px" className="size-12 shrink-0 rounded-lg border border-ink-600" />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-ink-600 bg-ink-900">
            <Quote className="size-4 text-gold-500/70" strokeWidth={1.25} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm text-ivory group-hover:text-gold-300">{row.name}</span>
            {row.city && <span className="truncate text-xs text-mute">{row.city}</span>}
            {!row.isActive && <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-mute">Hidden</span>}
          </span>
          <Stars rating={row.rating} size="size-2.5" className="mt-1" />
          {row.body && <span className="mt-0.5 block truncate text-xs text-stone">{row.body}</span>}
        </span>
        <ChevronRight className="size-4 shrink-0 text-mute group-hover:text-gold-400" />
      </Link>

      <Switch checked={row.isActive} onChange={(v) => onToggle(row.id, v)} label={`Show ${row.name} on the homepage`} />
    </li>
  );
}
