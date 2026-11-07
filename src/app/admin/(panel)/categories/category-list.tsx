"use client";

import Image from "next/image";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
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

export function CategoryList({ initial }: { initial: AdminCategoryRow[] }) {
  const [rows, setRows] = useState(initial);
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(rows);

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

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-ink-600 py-16 text-center text-sm text-mute">
        No categories yet.
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
      <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <ul className="divide-y divide-ink-600/60 overflow-hidden rounded-xl border border-ink-600/70 bg-ink-850">
          {optimistic.map((row) => (
            <Row key={row.id} row={row} onToggle={toggle} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function Row({ row, onToggle }: { row: AdminCategoryRow; onToggle: (id: string, v: boolean) => void }) {
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

      <Link href={`/admin/categories/${row.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
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
          </span>
          <span className="mt-0.5 block truncate text-xs text-mute">
            /shop/{row.slug} · {row.fieldCount} fields · {row.productCount} products
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-mute group-hover:text-gold-400" />
      </Link>

      <Switch checked={row.isActive} onChange={(v) => onToggle(row.id, v)} label={`Show ${row.name} in store`} />
    </li>
  );
}
