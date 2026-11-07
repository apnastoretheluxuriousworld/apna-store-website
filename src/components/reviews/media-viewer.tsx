"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import type { ReviewMedia } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

/**
 * Thumbnail for a review photo or video. A video without a poster shows its
 * first frame (`#t=0.1` makes browsers paint it from metadata).
 */
export function MediaThumb({ item, sizes = "96px", className }: { item: ReviewMedia; sizes?: string; className?: string }) {
  return (
    <span className={cn("relative block overflow-hidden bg-ink-900", className)}>
      {item.type === "image" ? (
        <Image src={item.url} alt="" fill sizes={sizes} unoptimized className="object-cover" />
      ) : item.poster ? (
        <Image src={item.poster} alt="" fill sizes={sizes} unoptimized className="object-cover" />
      ) : (
        <video src={`${item.url}#t=0.1`} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
      )}
      {item.type === "video" && (
        <span className="absolute inset-0 grid place-items-center bg-ink-950/25">
          <span className="grid size-7 place-items-center rounded-full border border-gold-400/60 bg-ink-950/60 backdrop-blur">
            <Play className="ml-0.5 size-3 fill-gold-400 text-gold-400" />
          </span>
        </span>
      )}
    </span>
  );
}

/** A row of thumbnails; tapping one opens the full-screen viewer. */
export function ReviewMediaStrip({
  media,
  label,
  thumbClassName = "size-16 rounded-lg sm:size-20",
}: {
  media: ReviewMedia[];
  /** Who/what the media belongs to, for screen readers ("Photo 2 of 3 from Priya"). */
  label: string;
  thumbClassName?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (!media.length) return null;
  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {media.map((m, i) => (
          <li key={m.url}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`${m.type === "video" ? "Video" : "Photo"} ${i + 1} of ${media.length} ${label}`}
              className="block rounded-lg ring-gold-400/60 transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:outline-none"
            >
              <MediaThumb item={m} className={cn("border border-gold-500/15", thumbClassName)} />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <MediaLightbox media={media} start={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Full-screen viewer for review photos and videos (←/→ and swipe to move, Esc to close). */
export function MediaLightbox({ media, start, onClose }: { media: ReviewMedia[]; start: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(start);
  const touchX = useRef<number | null>(null);
  const item = media[index];
  const many = media.length > 1;

  const go = useCallback((step: number) => setIndex((i) => (i + step + media.length) % media.length), [media.length]);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label="Review photos and videos"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (many && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-ink-950/95 backdrop:backdrop-blur-sm"
    >
      <div className="pointer-events-none flex h-full flex-col items-center justify-center p-4 pt-16 pb-20">
        {item.type === "image" ? (
          <div className="pointer-events-auto relative h-full w-full max-w-4xl">
            <Image src={item.url} alt="" fill sizes="100vw" unoptimized className="object-contain" />
          </div>
        ) : (
          <video
            key={item.url}
            src={item.url}
            poster={item.poster ?? undefined}
            controls
            autoPlay
            playsInline
            className="pointer-events-auto max-h-full max-w-full rounded-lg"
          />
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        autoFocus
        className="fixed top-4 right-4 grid size-11 place-items-center rounded-full border border-gold-500/30 bg-ink-900/80 text-ivory hover:text-gold-300"
      >
        <X className="size-5" />
      </button>
      {many && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous"
            className="fixed top-1/2 left-3 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-gold-500/30 bg-ink-900/80 text-ivory hover:text-gold-300 sm:grid"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next"
            className="fixed top-1/2 right-3 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-gold-500/30 bg-ink-900/80 text-ivory hover:text-gold-300 sm:grid"
          >
            <ChevronRight className="size-5" />
          </button>
          <p className="fixed inset-x-0 bottom-6 text-center text-xs tracking-[0.2em] text-stone" aria-live="polite">
            {index + 1} / {media.length}
          </p>
        </>
      )}
    </dialog>
  );
}
