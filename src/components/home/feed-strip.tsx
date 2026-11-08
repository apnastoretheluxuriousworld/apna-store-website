"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "motion/react";
import { ChevronRight, Volume2, VolumeX } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import type { FeedVideo } from "@/lib/data/feed";
import { FeedViewer } from "./feed-viewer";
import { cn } from "@/lib/utils";

/** Card centres are this far apart, as a fraction of the card width. */
const GAP = 0.62;

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True while the browser tab is in the foreground. */
function usePageVisible() {
  return useSyncExternalStore(
    (cb) => {
      document.addEventListener("visibilitychange", cb);
      return () => document.removeEventListener("visibilitychange", cb);
    },
    () => document.visibilityState === "visible",
    () => false,
  );
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Signed distance of card i from the (fractional) position, the short way round the loop. */
function dist(i: number, pos: number, n: number) {
  let d = mod(i - pos, n);
  if (d > n / 2) d -= n;
  return d;
}

/**
 * Homepage "Our Feed": an endless, centre-focus carousel of 9:16 cards. It never
 * moves by itself. Cards follow the finger/mouse, a flick rolls on with momentum
 * and settles on the nearest card. The centre card plays a silent preview only
 * while the carousel is on screen, the tab is visible and nothing is moving.
 * The speaker button on it turns sound on/off right in the carousel; tapping
 * anywhere else on it opens the full-screen player.
 */
export function FeedStrip({ videos }: { videos: FeedVideo[] }) {
  const n = videos.length;
  const [open, setOpen] = useState<number | null>(null);
  const [inView, setInView] = useState(false);
  const [moving, setMoving] = useState(false);
  /** Sound for the centre preview (off until the visitor taps the speaker). */
  const [sound, setSound] = useState(false);
  const muteSound = useCallback(() => setSound(false), []);
  const wide = useMedia("(min-width: 1024px)");
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const pageVisible = usePageVisible();
  const stage = useRef<HTMLDivElement>(null);
  const cardWidth = useRef(256);

  /** Continuous position: 0 = first card centred, 1.5 = halfway between 2nd and 3rd… (unbounded; wraps visually). */
  const pos = useMotionValue(0);
  const [active, setActive] = useState(0);
  useMotionValueEvent(pos, "change", (p) => {
    const a = mod(Math.round(p), n);
    setActive((prev) => (prev === a ? prev : a));
  });

  const anim = useRef<AnimationPlaybackControls | null>(null);
  const drag = useRef<{ x: number; pos: number; moved: boolean; samples: { x: number; t: number }[] } | null>(null);

  // Card width (for converting finger pixels → positions).
  useEffect(() => {
    const el = stage.current?.firstElementChild as HTMLElement | null;
    if (!el) return;
    const ro = new ResizeObserver(() => (cardWidth.current = el.offsetWidth || 256));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Preview only while most of the carousel is on screen.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /** Glide to a (fractional-free) target position. */
  function settleTo(target: number, velocity = 0) {
    anim.current?.stop();
    setMoving(true);
    anim.current = animate(pos, target, {
      type: "spring",
      velocity,
      stiffness: 170,
      damping: 26,
      restDelta: 0.001,
      onComplete: () => setMoving(false),
    });
  }

  /** Bring card i to the centre the short way round. */
  function goTo(i: number) {
    const p = pos.get();
    settleTo(Math.round(p) + Math.round(dist(i, Math.round(p), n)));
  }

  const spacing = () => cardWidth.current * GAP;
  const preview = inView && pageVisible && open === null && !reduced && !moving;

  return (
    <section className="overflow-hidden py-12 lg:py-20" aria-labelledby="feed-heading" aria-roledescription="carousel">
      <div className="mx-auto max-w-site px-4 lg:px-12">
        <Reveal>
          <div className="mb-6 flex items-end justify-between gap-4 lg:mb-10">
            <h2 id="feed-heading" className="text-[0.8rem] font-medium uppercase tracking-[0.22em] text-ivory lg:text-sm">
              Our Feed
            </h2>
            <button
              type="button"
              onClick={() => setOpen(active)}
              className="group flex items-center gap-1 text-xs text-gold-400 transition-colors hover:text-gold-300"
            >
              Watch all
              <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
            </button>
          </div>
        </Reveal>
      </div>

      <Reveal>
        <div
          ref={stage}
          className="relative mx-auto touch-pan-y select-none"
          onPointerDown={(e) => {
            if (n < 2 || (e.pointerType === "mouse" && e.button !== 0)) return;
            anim.current?.stop(); // catch a rolling carousel
            drag.current = { x: e.clientX, pos: pos.get(), moved: false, samples: [{ x: e.clientX, t: e.timeStamp }] };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const dx = e.clientX - d.x;
            if (!d.moved && Math.abs(dx) > 6) {
              d.moved = true;
              setMoving(true);
              e.currentTarget.setPointerCapture(e.pointerId); // keep sliding even off the cards
            }
            if (!d.moved) return;
            pos.set(d.pos - dx / spacing());
            d.samples.push({ x: e.clientX, t: e.timeStamp });
            if (d.samples.length > 6) d.samples.shift();
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            if (d?.moved) {
              // Finger speed over the last few moves → positions per second, then project where it would coast to.
              const first = d.samples[0];
              const dt = Math.max(1, e.timeStamp - first.t);
              const v = -((e.clientX - first.x) / dt) * 1000 / spacing();
              const coast = pos.get() + v * 0.28;
              const target = Math.round(Math.max(pos.get() - n, Math.min(pos.get() + n, coast)));
              settleTo(target, v);
            } else if (d) {
              // A tap: the card's own onClick handles it. If we had stopped a roll mid-way, finish snapping.
              const p = pos.get();
              if (Math.abs(p - Math.round(p)) > 0.001) settleTo(Math.round(p));
            }
            // Let the click that follows this pointerup see `moved`, then reset.
            setTimeout(() => (drag.current = null));
          }}
          onPointerCancel={() => {
            // The browser took the gesture (vertical page scroll).
            drag.current = null;
            settleTo(Math.round(pos.get()));
          }}
          onKeyDown={(e) => {
            const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
            if (step) settleTo(Math.round(pos.get()) + step);
          }}
        >
          {/* Sizes the stage to one centre card (and is measured for drag maths). */}
          <div className="invisible mx-auto aspect-9/16 w-56 sm:w-64 lg:w-72" aria-hidden />

          {videos.map((v, i) => (
            <Card
              key={v.id}
              video={v}
              index={i}
              n={n}
              pos={pos}
              wide={wide}
              centre={i === active}
              preview={preview && i === active}
              sound={sound}
              onToggleSound={() => setSound((s) => !s)}
              onSoundBlocked={muteSound}
              onClick={() => {
                if (drag.current?.moved) return; // it was a swipe
                if (i === active) setOpen(i);
                else goTo(i);
              }}
            />
          ))}
        </div>

        {n > 1 && (
          <div className="mt-8 flex flex-wrap justify-center gap-2 px-4" role="tablist" aria-label="Choose video">
            {videos.map((v, i) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Video ${i + 1}`}
                onClick={() => goTo(i)}
                className="grid h-6 place-items-center"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-all duration-500 ease-luxe",
                    i === active ? "w-7 bg-gold-400" : "w-1.5 bg-ivory/25 hover:bg-ivory/50",
                  )}
                />
              </button>
            ))}
          </div>
        )}
      </Reveal>

      {open !== null && <FeedViewer videos={videos} start={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function Card({
  video: v,
  index,
  n,
  pos,
  wide,
  centre,
  preview,
  sound,
  onToggleSound,
  onSoundBlocked,
  onClick,
}: {
  video: FeedVideo;
  index: number;
  n: number;
  pos: MotionValue<number>;
  wide: boolean;
  centre: boolean;
  preview: boolean;
  sound: boolean;
  onToggleSound: () => void;
  onSoundBlocked: () => void;
  onClick: () => void;
}) {
  // Everything below is derived from the continuous position, so cards move smoothly with the finger. Flat — no tilt.
  const d = useTransform(pos, (p) => (n > 1 ? dist(index, p, n) : 0));
  const x = useTransform(d, (d) => {
    const a = Math.abs(d);
    const s = Math.sign(d);
    const far = a <= 1 ? a * GAP : GAP + (a - 1) * 0.46;
    return `${s * far * 100}%`;
  });
  const scale = useTransform(d, (d) => {
    const a = Math.abs(d);
    return a <= 1 ? 1 - a * 0.18 : Math.max(0.5, 0.82 - (a - 1) * 0.16);
  });
  const opacity = useTransform(d, (d) => {
    const a = Math.abs(d);
    const lastVisible = wide ? 2 : 1;
    return a <= lastVisible ? 1 : Math.max(0, 1 - (a - lastVisible));
  });
  const zIndex = useTransform(d, (d) => Math.round(100 - Math.abs(d) * 10));
  const dim = useTransform(d, (d) => {
    const a = Math.abs(d);
    return a <= 1 ? a * 0.55 : Math.min(0.85, 0.55 + (a - 1) * 0.2);
  });
  const pointerEvents = useTransform(d, (d) => (Math.abs(d) <= (wide ? 2.5 : 1.5) ? "auto" : "none"));
  const label = v.caption || `video ${index + 1}`;

  return (
    // A div (not a <button>) so the speaker button can sit inside it.
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={centre ? `Watch ${label} full screen` : `Show ${label}`}
      aria-current={centre || undefined}
      style={{ x, scale, opacity, zIndex, pointerEvents }}
      className={cn(
        "absolute inset-y-0 inset-x-0 mx-auto block aspect-9/16 cursor-pointer w-56 overflow-hidden rounded-2xl border bg-ink-800 text-left will-change-transform sm:w-64 lg:w-72",
        "ring-gold-400/60 transition-[border-color,box-shadow] duration-500 focus-visible:ring-2 focus-visible:outline-none",
        centre ? "border-gold-500/50 shadow-[0_24px_60px_-20px_rgba(212,175,55,0.45)]" : "border-gold-500/15",
      )}
    >
      {v.posterUrl ? (
        <Image src={v.posterUrl} alt="" fill sizes="(min-width: 1024px) 288px, 256px" unoptimized draggable={false} className="object-cover" />
      ) : (
        <video src={`${v.videoUrl}#t=0.1`} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
      )}
      {/* Silent preview on the centre card only, once it has settled. */}
      {preview && <Preview video={v} sound={sound} onSoundBlocked={onSoundBlocked} />}

      {v.caption && (
        <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-ink-950/90 via-ink-950/50 to-transparent p-4 pt-14">
          <span className="line-clamp-2 font-serif text-xl leading-snug text-ivory uppercase">{v.caption}</span>
        </span>
      )}
      {centre && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation(); // don't open full screen
            onToggleSound();
          }}
          aria-label={sound ? "Mute" : "Unmute"}
          aria-pressed={sound}
          className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full border border-gold-400/50 bg-ink-950/60 text-gold-300 backdrop-blur transition-colors hover:text-gold-200"
        >
          {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
      )}
      {/* Dim the cards behind. */}
      <motion.span aria-hidden style={{ opacity: dim }} className="pointer-events-none absolute inset-0 bg-ink-950" />
    </motion.div>
  );
}

/** The centre card's looping preview. Sound follows the speaker button; if the browser blocks sound, it plays muted. */
function Preview({ video: v, sound, onSoundBlocked }: { video: FeedVideo; sound: boolean; onSoundBlocked: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = !sound; // React doesn't keep `muted` in sync, so set it directly
    el.play().catch((e: unknown) => {
      if (e instanceof DOMException && e.name === "NotAllowedError" && !el.muted) {
        el.muted = true;
        onSoundBlocked();
        el.play().catch(() => {});
      }
    });
  }, [sound, onSoundBlocked]);
  return (
    <video
      ref={ref}
      src={v.videoUrl}
      poster={v.posterUrl ?? undefined}
      muted
      loop
      playsInline
      preload="metadata"
      className="absolute inset-0 size-full object-cover"
    />
  );
}
