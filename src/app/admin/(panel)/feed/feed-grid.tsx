"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clapperboard, GripVertical, Loader2 } from "lucide-react";
import { Switch } from "@/components/admin/form";
import { SyncBadge, enqueue, useOutbox, type Job } from "@/components/admin/outbox";
import type { AdminFeedRow } from "@/lib/data/feed";
import { reorderFeed, setFeedVideoActive } from "./actions";
import { FEED_INPUT_ID } from "./constants";
import { FEED_ACCEPT, VIDEO_MAX_MB, uploadFeedVideo, type FeedUpload } from "./upload";
import { cn } from "@/lib/utils";


type Uploading = { id: string; name: string; progress: number };

export function FeedGrid({ initial }: { initial: AdminFeedRow[] }) {
  const [rows, setRows] = useState(initial);
  // Next keeps visited pages mounted: adopt fresh server rows when they arrive.
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setRows(initial);
  }
  const [, startTransition] = useTransition();
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const queue = useOutbox();
  const { shown, sync, serverIds } = useMemo(() => overlay(rows, queue), [rows, queue]);

  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function addFiles(files: File[]) {
    const items = files.map((f) => ({ id: crypto.randomUUID(), name: f.name, progress: 0 }));
    setUploading((u) => [...items, ...u]);
    const results = await Promise.allSettled(
      files.map((file, i) =>
        uploadFeedVideo(file, (pct) => setUploading((u) => u.map((x) => (x.id === items[i].id ? { ...x, progress: pct } : x)))),
      ),
    );
    setUploading((u) => u.filter((x) => !items.some((it) => it.id === x.id)));

    // The server puts each new video first, so queue them last-to-first to keep the order they were picked in.
    const done: { id: string; up: FeedUpload; name: string }[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") done.push({ id: items[i].id, up: r.value, name: files[i].name });
      else toast.error(`${files[i].name}: ${r.reason instanceof Error ? r.reason.message : "Upload failed"}`);
    });
    for (const { id, up, name } of [...done].reverse()) {
      const payload = { id, caption: "", videoUrl: up.videoUrl, posterUrl: up.posterUrl, isActive: true };
      enqueue({
        kind: "feed.save",
        entityId: id,
        label: name,
        payload,
        formValues: payload,
        preview: { ...payload },
      });
    }
    for (const { up, name } of done) if (up.warning) toast.warning(`${name} ${up.warning}`);
    if (done.length) toast.success(done.length === 1 ? "Video added to the feed" : `${done.length} videos added to the feed`);
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = rows.findIndex((r) => r.id === e.active.id);
    const to = rows.findIndex((r) => r.id === e.over!.id);
    if (from < 0 || to < 0) return; // a video that hasn't synced yet
    const next = arrayMove(rows, from, to);
    const prev = rows;
    setRows(next);
    startTransition(async () => {
      const res = await reorderFeed(next.map((r) => r.id));
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
      const res = await setFeedVideoActive(id, isActive);
      if (res.ok) toast.success(isActive ? "Shown in the feed" : "Hidden from the feed");
      else {
        setRows(prev);
        toast.error(res.error);
      }
    });
  }

  const empty = !shown.length && !uploading.length;

  return (
    <>
      <input
        id={FEED_INPUT_ID}
        type="file"
        accept={FEED_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) void addFiles(files);
          e.target.value = "";
        }}
      />

      {empty ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-ink-600 py-16 text-center">
          <Clapperboard className="size-6 text-gold-500/70" strokeWidth={1.25} />
          <p className="mt-3 text-sm text-stone">No videos yet</p>
          <p className="mt-1 text-xs text-mute">9:16 · up to {VIDEO_MAX_MB} MB</p>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("video/"));
            if (!files.length) return;
            e.preventDefault();
            void addFiles(files);
          }}
        >
          <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={shown.map((r) => r.id)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {uploading.map((u) => (
                  <li key={u.id} className="flex aspect-9/16 flex-col items-center justify-center gap-2 rounded-xl border border-ink-600 bg-ink-900 px-2 text-center">
                    <Loader2 className="size-5 animate-spin text-gold-400" />
                    <span className="text-xs text-gold-300">{u.progress}%</span>
                    <span className="w-full truncate text-[0.6rem] text-mute">{u.name}</span>
                  </li>
                ))}
                {shown.map((row) => (
                  <Tile key={row.id} row={row} onToggle={toggle} sync={sync.get(row.id)} onServer={serverIds.has(row.id)} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </>
  );
}

function Tile({
  row,
  onToggle,
  sync,
  onServer,
}: {
  row: AdminFeedRow;
  onToggle: (id: string, v: boolean) => void;
  sync?: Job["status"];
  onServer: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const label = row.caption || "Untitled video";
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group relative aspect-9/16 overflow-hidden rounded-xl border border-ink-600 bg-ink-900",
        isDragging && "z-10 shadow-2xl ring-1 ring-gold-500/40",
        !onServer && "pointer-events-none",
        !row.isActive && "opacity-60",
      )}
    >
      <Link href={`/admin/feed/${row.id}`} aria-label={`Edit ${label}`} className="absolute inset-0">
        {row.posterUrl ? (
          <Image src={row.posterUrl} alt="" fill sizes="200px" unoptimized className="object-cover" />
        ) : (
          <video src={`${row.videoUrl}#t=0.1`} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
        )}
        <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink-950 via-ink-950/70 to-transparent px-2.5 pt-8 pb-12">
          <span className={cn("line-clamp-2 text-xs", row.caption ? "text-ivory" : "text-mute italic")}>{label}</span>
        </span>
      </Link>

      <span className="pointer-events-none absolute top-2 left-2 flex flex-col items-start gap-1">
        {!row.isActive && <span className="rounded bg-ink-950/85 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-stone">Hidden</span>}
        {sync && <SyncBadge failed={sync === "failed"} className="bg-ink-950/85" />}
      </span>

      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${label}`}
        className="absolute top-1.5 right-1.5 grid size-8 cursor-grab touch-none place-items-center rounded-full bg-ink-950/80 text-stone hover:text-gold-400 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>

      <span className="absolute right-2 bottom-2">
        <Switch size="sm" checked={row.isActive} onChange={(v) => onToggle(row.id, v)} label={`Show ${label} in the feed`} />
      </span>
    </li>
  );
}

/** Queued (not yet synced) saves/deletes on top of the server rows; new videos go first. */
function overlay(rows: AdminFeedRow[], queue: Job[]) {
  let shown = rows;
  const sync = new Map<string, Job["status"]>();
  for (const job of queue) {
    if (job.kind === "feed.delete") {
      shown = shown.filter((r) => r.id !== job.entityId);
    } else if (job.kind === "feed.save" && job.preview) {
      const preview = job.preview as Partial<AdminFeedRow>;
      const i = shown.findIndex((r) => r.id === job.entityId);
      shown = i >= 0 ? shown.map((r, j) => (j === i ? { ...r, ...preview } : r)) : [preview as AdminFeedRow, ...shown];
      sync.set(job.entityId, job.status);
    }
  }
  return { shown, sync, serverIds: new Set(rows.map((r) => r.id)) };
}
