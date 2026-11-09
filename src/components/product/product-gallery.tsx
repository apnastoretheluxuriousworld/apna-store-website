"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Play } from "lucide-react";
import { CategoryIcon } from "@/components/brand/category-icon";
import { MediaLightbox } from "@/components/reviews/media-viewer";
import type { ProductMedia } from "@/lib/data/products";
import { cn } from "@/lib/utils";

/**
 * Product photos & videos. Swipe (phones) or arrows/thumbnails (desktop);
 * tap the main image to open the full-screen viewer. Videos play muted inline.
 */
export function ProductGallery({ media, name, categorySlug }: { media: ProductMedia[]; name: string; categorySlug: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);

  function goTo(i: number) {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(media.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  if (!media.length) {
    return (
      <div className="relative grid aspect-4/5 place-items-center overflow-hidden rounded-2xl border border-gold-500/10 bg-ink-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,rgba(212,175,55,0.2),transparent_60%)]" />
        <CategoryIcon slug={categorySlug} className="relative size-24 text-gold-400/80" strokeWidth={0.6} />
      </div>
    );
  }

  return (
    <div className="lg:flex lg:flex-row-reverse lg:gap-4">
      <div className="relative min-w-0 flex-1">
        <div
          ref={track}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="flex aspect-4/5 snap-x snap-mandatory overflow-x-auto scrollbar-none sm:rounded-2xl sm:border sm:border-gold-500/10"
          aria-roledescription="carousel"
          aria-label={`${name} photos`}
        >
          {media.map((m, i) => (
            <button
              key={m.url}
              type="button"
              onClick={() => setViewer(i)}
              aria-label={`View ${m.type === "video" ? "video" : "photo"} ${i + 1} of ${media.length} full screen`}
              className="relative size-full shrink-0 snap-center cursor-zoom-in bg-ink-950"
            >
              {m.type === "image" ? (
                <Image
                  src={m.url}
                  alt={m.alt}
                  fill
                  priority={i === 0}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <video
                  src={m.url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 size-full object-cover"
                />
              )}
            </button>
          ))}
        </div>

        {media.length > 1 && (
          <>
            <span className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-ink-950/80 px-2.5 py-1 text-[0.65rem] tracking-wider text-ivory/90 tabular-nums lg:hidden">
              {index + 1} / {media.length}
            </span>
            <div className="pointer-events-none absolute inset-x-0 bottom-3.5 flex justify-center gap-1.5 lg:hidden">
              {media.map((m, i) => (
                <span
                  key={m.url}
                  className={cn("h-1 rounded-full transition-all duration-300", i === index ? "bg-gold w-4" : "w-1 bg-ivory/40")}
                />
              ))}
            </div>
            <ArrowButton side="left" disabled={index === 0} onClick={() => goTo(index - 1)} />
            <ArrowButton side="right" disabled={index === media.length - 1} onClick={() => goTo(index + 1)} />
          </>
        )}
        <span className="pointer-events-none absolute top-3 right-3 hidden size-9 place-items-center rounded-full bg-ink-950/75 text-ivory/80 lg:grid">
          <Expand className="size-4" strokeWidth={1.5} />
        </span>
      </div>

      {media.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:px-0 lg:mt-0 lg:w-20 lg:flex-col lg:overflow-visible">
          {media.map((m, i) => (
            <button
              key={m.url}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show ${m.type === "video" ? "video" : "photo"} ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "relative aspect-4/5 w-16 shrink-0 overflow-hidden rounded-lg border transition-all lg:w-full",
                i === index ? "border-gold-400" : "border-ink-600 opacity-60 hover:opacity-100",
              )}
            >
              {m.type === "image" ? (
                <Image src={m.url} alt="" fill sizes="80px" className="object-cover" />
              ) : (
                <>
                  <video src={`${m.url}#t=0.1`} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
                  <span className="absolute inset-0 grid place-items-center bg-ink-950/30">
                    <Play className="ml-0.5 size-3.5 fill-gold-400 text-gold-400" />
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {viewer !== null && (
        <MediaLightbox
          media={media.map((m) => ({ type: m.type, url: m.url }))}
          start={viewer}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

function ArrowButton({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={cn(
        "absolute top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-gold-500/30 bg-ink-950/80 text-ivory transition-opacity hover:text-gold-300 disabled:opacity-0 lg:grid",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon className="size-5" strokeWidth={1.5} />
    </button>
  );
}
