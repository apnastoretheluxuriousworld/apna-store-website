"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import { ChevronDown, ChevronUp, Play, Volume2, VolumeX, X } from "lucide-react";
import type { FeedVideo } from "@/lib/data/feed";
import { cn } from "@/lib/utils";

/**
 * Full-screen video player, one 9:16 video per screen; the visible one plays
 * (looping) and the rest pause. Swipe up/down (native scroll) or left/right to
 * change video — by touch or mouse. Phone back button / Esc close it.
 * ↑/↓/←/→ (or j/k) move, M mutes, tap pauses.
 */
export function FeedViewer({ videos, start, onClose }: { videos: FeedVideo[]; start: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(start);
  // Opening is a tap, so sound is usually allowed; if the browser refuses, we fall back to muted.
  const [muted, setMuted] = useState(false);
  const lenis = useLenis();
  /** Gesture in progress: start point, and whether it has moved enough to be a swipe (not a tap). */
  const gesture = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  // Close through history so the phone's back button/gesture closes the player instead of leaving the page.
  const closing = useRef(false);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if ((window.history.state as { apnaFeed?: boolean } | null)?.apnaFeed) window.history.back();
    else onClose();
  }, [onClose]);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    // Jump straight to the tapped video.
    const s = scroller.current;
    if (s) s.scrollTop = start * s.clientHeight;

    lenis?.stop();
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    // (Skip if already pushed — React StrictMode runs this twice in dev.)
    if (!(window.history.state as { apnaFeed?: boolean } | null)?.apnaFeed) {
      window.history.pushState({ ...window.history.state, apnaFeed: true }, "");
    }
    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      lenis?.start();
      document.documentElement.style.overflow = prevOverflow;
      d?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  // The slide that's mostly on screen is the active one.
  useEffect(() => {
    const s = scroller.current;
    if (!s) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { root: s, threshold: 0.6 },
    );
    s.querySelectorAll("[data-index]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const go = useCallback(
    (step: number) => {
      const s = scroller.current;
      if (!s) return;
      const i = Math.max(0, Math.min(videos.length - 1, active + step));
      s.scrollTo({ top: i * s.clientHeight, behavior: "smooth" });
    },
    [active, videos.length],
  );

  return (
    <dialog
      ref={dialog}
      aria-label="Our Feed"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={(e) => {
        const step = { ArrowDown: 1, ArrowRight: 1, j: 1, ArrowUp: -1, ArrowLeft: -1, k: -1 }[e.key];
        if (step) {
          e.preventDefault();
          go(step);
        } else if (e.key === "m") setMuted((m) => !m);
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-black p-0 text-ivory backdrop:bg-black"
    >
      <div
        ref={scroller}
        data-lenis-prevent
        // Vertical touch swipes scroll natively (snap). Horizontal swipes (touch or mouse)
        // and vertical mouse drags are handled here.
        onTouchStart={(e) => {
          const t = e.touches[0];
          gesture.current = { x: t.clientX, y: t.clientY, moved: false };
        }}
        onTouchEnd={(e) => {
          const g = gesture.current;
          gesture.current = null;
          if (!g) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - g.x;
          const dy = t.clientY - g.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? 1 : -1);
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button === 0) gesture.current = { x: e.clientX, y: e.clientY, moved: false };
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (e.pointerType === "mouse" && g && !g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10) g.moved = true;
        }}
        onPointerUp={(e) => {
          if (e.pointerType !== "mouse") return;
          const g = gesture.current;
          if (g?.moved) {
            const dx = e.clientX - g.x;
            const dy = e.clientY - g.y;
            if (Math.abs(dx) > Math.abs(dy) ? Math.abs(dx) > 50 : Math.abs(dy) > 50) {
              go(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : -1) : dy < 0 ? 1 : -1);
            }
          }
          setTimeout(() => (gesture.current = null));
        }}
        onClickCapture={(e) => {
          if (gesture.current?.moved) e.stopPropagation(); // a slide, not a tap to pause
        }}
        className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain scrollbar-none"
      >
        {videos.map((v, i) => (
          <Slide
            key={v.id}
            video={v}
            index={i}
            active={i === active}
            near={Math.abs(i - active) <= 1}
            muted={muted}
            onAutoplayBlocked={() => setMuted(true)}
          />
        ))}
      </div>

      {/* Top bar */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-10 flex items-center justify-between bg-linear-to-b from-black/60 to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          autoFocus
          className="pointer-events-auto grid size-11 place-items-center rounded-full bg-black/40 text-ivory backdrop-blur hover:text-gold-300"
        >
          <X className="size-5" />
        </button>
        <p className="text-[0.65rem] uppercase tracking-[0.25em] text-ivory/80" aria-live="polite">
          {active + 1} / {videos.length}
        </p>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute" : "Mute"}
          className="pointer-events-auto grid size-11 place-items-center rounded-full bg-black/40 text-ivory backdrop-blur hover:text-gold-300"
        >
          {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </button>
      </div>

      {/* Desktop: up/down buttons beside the video column */}
      {videos.length > 1 && (
        <div className="fixed top-1/2 right-6 z-10 hidden -translate-y-1/2 flex-col gap-3 md:flex">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={active === 0}
            aria-label="Previous video"
            className="grid size-12 place-items-center rounded-full border border-gold-500/30 bg-ink-900/80 text-ivory hover:text-gold-300 disabled:opacity-30"
          >
            <ChevronUp className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={active === videos.length - 1}
            aria-label="Next video"
            className="grid size-12 place-items-center rounded-full border border-gold-500/30 bg-ink-900/80 text-ivory hover:text-gold-300 disabled:opacity-30"
          >
            <ChevronDown className="size-5" />
          </button>
        </div>
      )}
    </dialog>
  );
}

function Slide({
  video,
  index,
  active,
  near,
  muted,
  onAutoplayBlocked,
}: {
  video: FeedVideo;
  index: number;
  active: boolean;
  /** Only the active video and its neighbours load; the rest show their poster. */
  near: boolean;
  muted: boolean;
  onAutoplayBlocked: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [paused, setPaused] = useState(false);

  // Play from the start when it becomes the active slide; pause when it leaves.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (!active) {
      v.pause();
      return;
    }
    v.currentTime = 0;
    v.play().catch((e: unknown) => {
      // Sound blocked until the viewer interacts: play muted instead.
      if (e instanceof DOMException && e.name === "NotAllowedError" && !v.muted) {
        v.muted = true;
        onAutoplayBlocked();
        v.play().catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on (de)activation
  }, [active, near]);

  // React doesn't keep the `muted` property in sync on updates, so set it directly.
  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted, near]);

  // Progress bar, painted every frame while active.
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const v = ref.current;
      if (v && bar.current && v.duration) bar.current.style.transform = `scaleX(${v.currentTime / v.duration})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  function togglePlay() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  return (
    <section data-index={index} className="relative flex h-dvh snap-start snap-always justify-center" aria-label={video.caption || `Video ${index + 1}`}>
      <div className="relative h-full w-full md:w-auto md:aspect-9/16">
        {video.posterUrl && (
          <Image src={video.posterUrl} alt="" fill sizes="(min-width: 768px) 56vh, 100vw" unoptimized className="object-cover" />
        )}
        {near && (
          <video
            ref={ref}
            src={video.videoUrl}
            poster={video.posterUrl ?? undefined}
            muted={muted}
            loop
            playsInline
            preload="auto"
            onClick={togglePlay}
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
            className="absolute inset-0 size-full cursor-pointer object-cover"
          />
        )}
        {paused && active && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Play"
            className="absolute inset-0 grid place-items-center bg-black/20"
          >
            <span className="grid size-16 place-items-center rounded-full border border-gold-400/60 bg-black/50 backdrop-blur">
              <Play className="ml-1 size-6 fill-gold-400 text-gold-400" />
            </span>
          </button>
        )}

        {video.caption && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/40 to-transparent px-5 pt-20 pb-[max(1.75rem,calc(env(safe-area-inset-bottom)+1rem))]">
            <p className="max-w-md font-serif text-xl leading-snug text-ivory">{video.caption}</p>
          </div>
        )}
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/15">
          <span ref={bar} className={cn("block h-full origin-left scale-x-0 bg-gold-400", !active && "invisible")} />
        </span>
      </div>
    </section>
  );
}
