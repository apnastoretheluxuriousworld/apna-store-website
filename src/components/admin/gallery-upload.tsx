"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ImagePlus, Link2, Loader2, Play, X } from "lucide-react";
import { uploadImage, type UploadFolder } from "./image-upload";
import { discardUpload } from "@/app/admin/(panel)/upload-actions";
import { inputClass } from "./form";
import { cn } from "@/lib/utils";
import { ACCEPT_IMAGES, ACCEPT_VIDEOS, coverOf, isVideoUrl } from "@/lib/media";

export type GalleryImage = { url: string; alt?: string };

type Pending = { id: string; name: string; progress: number };

/**
 * Product gallery of photos and videos: upload several at once, drag to reorder,
 * remove, or add by URL. The first photo is the cover (videos never are).
 * Photos are resized/converted in the browser; videos upload as-is (max 200 MB).
 * Controlled: `value` is the ordered list.
 */
export function GalleryUpload({
  value,
  onChange,
  folder = "products",
  max = 12,
  invalid,
}: {
  value: GalleryImage[];
  onChange: (next: GalleryImage[]) => void;
  folder?: UploadFolder;
  max?: number;
  invalid?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [urlMode, setUrlMode] = useState(false);
  const [urlText, setUrlText] = useState("");
  // Uploads finish out of order and the parent's value may be stale in their closures.
  const latest = useRef(value);
  latest.current = value;
  // Uploaded during this visit: if removed before saving, nothing will reference
  // them, so delete from the bucket now. Saved images are cleaned up on save.
  const uploadedHere = useRef(new Set<string>());

  function remove(url: string) {
    onChange(value.filter((x) => x.url !== url));
    if (uploadedHere.current.delete(url)) void discardUpload(url);
  }

  const room = max - value.length - pending.length;
  const coverUrl = coverOf(value)?.url;

  // SSR-stable id for dnd-kit's aria-describedby (its own counter differs between server and browser → hydration mismatch).
  const dndId = useId();
  // Mouse + Touch (not Pointer): a PointerSensor claims the touch first, then the
  // browser cancels it to scroll, so dragging never started on phones. Touch needs
  // a short press-and-hold, which keeps normal scrolling over the thumbnails.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function addFiles(files: File[]) {
    setErrors([]);
    const batch = files.slice(0, Math.max(0, room));
    if (files.length > batch.length) setErrors([`Only ${max} photos and videos per product — ${files.length - batch.length} skipped.`]);
    const items = batch.map((f) => ({ id: crypto.randomUUID(), name: f.name, progress: 0 }));
    setPending((p) => [...p, ...items]);

    // Upload in parallel but append in the order the files were picked.
    const results = await Promise.all(
      batch.map(async (file, i) => {
        try {
          return await uploadImage(file, folder, (pct) =>
            setPending((p) => p.map((x) => (x.id === items[i].id ? { ...x, progress: pct } : x))),
          );
        } catch (e) {
          setErrors((es) => [...es, `${file.name}: ${e instanceof Error ? e.message : "Upload failed"}`]);
          return null;
        } finally {
          setPending((p) => p.filter((x) => x.id !== items[i].id));
        }
      }),
    );
    const urls = results.filter((u): u is string => !!u);
    urls.forEach((u) => uploadedHere.current.add(u));
    if (urls.length) onChange([...latest.current, ...urls.map((url) => ({ url, alt: "" }))]);
  }

  function addUrl() {
    const url = urlText.trim();
    if (!url) return;
    if (!(url.startsWith("/") || url.startsWith("https://"))) return setErrors(["URL must start with https:// or /"]);
    if (value.some((i) => i.url === url)) return setErrors(["That's already in the gallery"]);
    onChange([...value, { url, alt: "" }]);
    setUrlText("");
    setErrors([]);
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = value.findIndex((i) => i.url === e.active.id);
    const to = value.findIndex((i) => i.url === e.over!.id);
    onChange(arrayMove(value, from, to));
  }

  return (
    <div className="space-y-3">
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={value.map((i) => i.url)} strategy={rectSortingStrategy}>
          <ul
            className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
              if (files.length) addFiles(files);
            }}
          >
            {value.map((img) => (
              <Thumb key={img.url} img={img} cover={img.url === coverUrl} onRemove={() => remove(img.url)} />
            ))}
            {pending.map((p) => (
              <li key={p.id} className="relative grid aspect-4/5 place-items-center rounded-lg border border-ink-600 bg-ink-900">
                <div className="flex flex-col items-center gap-1.5 text-[0.65rem] text-gold-300">
                  <Loader2 className="size-4 animate-spin" />
                  {p.progress}%
                </div>
              </li>
            ))}
            {room > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  className={cn(
                    "flex aspect-4/5 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-mute transition-colors hover:border-gold-500/60 hover:text-gold-300",
                    invalid ? "border-red-500/60" : "border-gold-500/30",
                  )}
                >
                  <ImagePlus className="size-6" strokeWidth={1.25} />
                  <span className="px-2 text-center text-[0.65rem]">Add photos or videos</span>
                </button>
              </li>
            )}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-mute">
        <span>
          {value.length} / {max} · first photo is the cover · hold & drag to reorder
        </span>
        <button type="button" onClick={() => setUrlMode((v) => !v)} className="inline-flex items-center gap-1.5 text-stone hover:text-gold-300">
          <Link2 className="size-3.5" /> Add by URL
        </button>
      </div>

      {urlMode && (
        <div className="flex gap-2">
          <input
            className={cn(inputClass, "h-9 text-xs")}
            placeholder="https://… (photo or .mp4 video)"
            aria-label="Photo or video URL"
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
          />
          <button type="button" onClick={addUrl} className="h-9 shrink-0 rounded-lg border border-ink-600 px-3 text-xs text-stone hover:border-gold-500/40 hover:text-gold-300">
            Add
          </button>
        </div>
      )}

      {errors.map((e) => (
        <p key={e} className="text-xs text-red-400" role="alert">
          {e}
        </p>
      ))}

      <input
        ref={input}
        type="file"
        multiple
        accept={`${ACCEPT_IMAGES},${ACCEPT_VIDEOS}`}
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) addFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Thumb({ img, cover, onRemove }: { img: GalleryImage; cover: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.url });
  const video = isVideoUrl(img.url);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group relative aspect-4/5 cursor-grab touch-manipulation overflow-hidden rounded-lg border bg-ink-900 select-none [-webkit-touch-callout:none] active:cursor-grabbing",
        cover ? "border-gold-500/60" : "border-ink-600",
        isDragging && "z-10 shadow-2xl ring-2 ring-gold-500/50",
      )}
      {...attributes}
      {...listeners}
      aria-label={`${cover ? "Cover photo" : video ? "Video" : "Photo"} — drag to reorder`}
    >
      {video ? (
        <>
          {/* #t=0.1 makes browsers paint the first frame as a preview */}
          <video src={`${img.url}#t=0.1`} muted playsInline preload="metadata" className="pointer-events-none size-full object-cover" />
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid size-8 place-items-center rounded-full bg-ink-950/70 backdrop-blur">
              <Play className="ml-0.5 size-3.5 fill-ivory text-ivory" />
            </span>
          </span>
        </>
      ) : (
        <Image src={img.url} alt="" fill sizes="160px" unoptimized className="pointer-events-none object-cover" />
      )}
      {cover && (
        <span className="absolute bottom-1.5 left-1.5 rounded bg-ink-950/85 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-wider text-gold-300">
          Cover
        </span>
      )}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
        aria-label="Remove image"
        className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-ink-950/85 text-stone hover:text-red-300"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}
