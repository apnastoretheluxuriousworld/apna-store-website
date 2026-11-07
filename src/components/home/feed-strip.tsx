"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronRight, Play } from "lucide-react";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import type { FeedVideo } from "@/lib/data/feed";
import { FeedViewer } from "./feed-viewer";

/** Horizontal strip of 9:16 cards; tapping one opens the full-screen vertical player there. */
export function FeedStrip({ videos }: { videos: FeedVideo[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-12 lg:py-20" aria-labelledby="feed-heading">
      <div className="mx-auto max-w-site px-4 lg:px-12">
        <Reveal>
          <div className="mb-5 flex items-end justify-between gap-4 lg:mb-8">
            <h2 id="feed-heading" className="text-[0.8rem] font-medium uppercase tracking-[0.22em] text-ivory lg:text-sm">
              Our Feed
            </h2>
            <button
              type="button"
              onClick={() => setOpen(0)}
              className="group flex items-center gap-1 text-xs text-gold-400 transition-colors hover:text-gold-300"
            >
              Watch all
              <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
            </button>
          </div>
        </Reveal>
      </div>
      <RevealGroup className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-none lg:mx-auto lg:max-w-site lg:gap-5 lg:px-12">
        {videos.map((v, i) => (
          <RevealItem key={v.id} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Play ${v.caption || `video ${i + 1}`}`}
              className="group relative block aspect-9/16 w-40 overflow-hidden rounded-xl border border-gold-500/10 bg-ink-800 text-left ring-gold-400/60 focus-visible:ring-2 focus-visible:outline-none sm:w-48 lg:w-56"
            >
              {v.posterUrl ? (
                <Image
                  src={v.posterUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 224px, (min-width: 640px) 192px, 160px"
                  unoptimized
                  className="object-cover opacity-90 transition-transform duration-1000 ease-luxe group-hover:scale-105"
                />
              ) : (
                <video
                  src={`${v.videoUrl}#t=0.1`}
                  muted
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 size-full object-cover opacity-90 transition-transform duration-1000 ease-luxe group-hover:scale-105"
                />
              )}
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-12 place-items-center rounded-full border border-gold-400/60 bg-ink-950/50 backdrop-blur transition-transform duration-500 group-hover:scale-110">
                  <Play className="ml-0.5 size-4 fill-gold-400 text-gold-400" />
                </span>
              </span>
              {v.caption && (
                <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink-950 to-transparent p-3 pt-10">
                  <span className="line-clamp-2 font-serif text-lg leading-snug text-ivory">{v.caption}</span>
                </span>
              )}
            </button>
          </RevealItem>
        ))}
      </RevealGroup>

      {open !== null && <FeedViewer videos={videos} start={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
