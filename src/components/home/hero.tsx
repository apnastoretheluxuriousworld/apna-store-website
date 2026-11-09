"use client";

import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
  type PanInfo,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import type { HeroSlide } from "@/lib/data/hero";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;
const AUTOPLAY_MS = 5000;

/** Shown only when there are no banners or collection covers yet (or the DB is unreachable). */
const BRAND_SLIDE: HeroSlide = {
  key: "brand",
  image: "/demo/watches/aurum-chronograph.webp",
  eyebrow: "The Luxurious World",
  title: "Crafted for",
  highlight: "Presence.",
  subtitle:
    "Timepieces, fragrances & leather — curated for those who notice every detail.",
  ctaLabel: "Shop now",
  ctaHref: "/shop",
};

/**
 * Homepage hero carousel: the banners from Admin → Hero banners (starts with one
 * per collection). Phones: full-width image with the text and button over it.
 * Desktop: text on the left, image on the right fading into the black.
 * Autoplays every 5s (the timer restarts after a swipe or dot tap), swipes on
 * touch, and keys ←/→ when focused.
 */
export function Hero({ slides: fromDb }: { slides: HeroSlide[] }) {
  const slides = fromDb.length > 0 ? fromDb : [BRAND_SLIDE];
  const count = slides.length;
  const [[index, dir], setState] = useState<[number, number]>([0, 1]);

  const go = useCallback(
    (next: number, d: number) => setState([(next + count) % count, d]),
    [count],
  );

  useEffect(() => {
    if (count < 2) return;
    const t = setTimeout(() => go(index + 1, 1), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [index, count, go]);

  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const visualY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (count < 2) return;
    if (info.offset.x < -50 || info.velocity.x < -400) go(index + 1, 1);
    else if (info.offset.x > 50 || info.velocity.x > 400) go(index - 1, -1);
  };

  const slide = slides[index];

  return (
    <section
      ref={ref}
      aria-roledescription="carousel"
      aria-label="Featured"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1, 1);
        if (e.key === "ArrowLeft") go(index - 1, -1);
      }}
      className="grain relative isolate flex min-h-[88svh] flex-col overflow-hidden bg-ink-950 outline-none lg:min-h-[82vh]"
    >
      {/* Light: slow-rotating golden rays + warm glow behind the centred cover */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[42%] left-1/2 size-[150vw] max-h-350 max-w-350 -translate-x-1/2 -translate-y-1/2 lg:size-[85vw]">
          <div
            className="hero-rays size-full rounded-full opacity-40 blur-2xl mask-[radial-gradient(circle,black_10%,transparent_65%)]"
            style={{
              background:
                "repeating-conic-gradient(from 0deg, rgba(245,215,122,0.35) 0deg 2deg, transparent 2deg 14deg)",
            }}
          />
        </div>
        <div className="absolute top-[42%] left-1/2 size-[95vw] max-h-200 max-w-200 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.26),rgba(184,134,11,0.08)_40%,transparent_70%)] lg:size-[55vw]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-ink-900 to-transparent" />
      </div>

      {/* Swipe surface: the full-width cover image, below the fixed header */}
      <motion.div
        style={{ y: visualY }}
        drag={count > 1 ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={onDragEnd}
        className="absolute inset-x-0 top-16 bottom-[26%] cursor-grab touch-pan-y active:cursor-grabbing lg:top-28 lg:right-12 lg:bottom-16 lg:left-[45%]"
      >
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={slide.key}
            custom={dir}
            variants={{
              enter: (d: number) => ({
                opacity: 0,
                x: d * 60,
                scale: 1.04,
              }),
              center: { opacity: 1, x: 0, scale: 1 },
              exit: (d: number) => ({
                opacity: 0,
                x: d * -60,
                scale: 0.97,
              }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.8, ease }}
            className="absolute inset-0 will-change-transform mask-[linear-gradient(to_bottom,black_75%,transparent)] lg:[mask-composite:intersect] lg:[mask-image:linear-gradient(to_right,transparent,black_25%,black_85%,transparent),linear-gradient(to_bottom,transparent,black_12%,black_80%,transparent)]"
          >
            <Image
              src={slide.image}
              alt={[slide.eyebrow, slide.title, slide.highlight]
                .filter(Boolean)
                .join(" ")}
              fill
              priority={index === 0}
              draggable={false}
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="pointer-events-none object-cover select-none"
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Keep the overlaid copy legible */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-ink-950 via-ink-950/85 to-transparent lg:hidden"
      />

      {/* Copy: centred over the image on phones, left column on desktop */}
      <motion.div
        style={{ y: textY, opacity: fade }}
        className="relative z-10 mx-auto mt-auto w-full max-w-site px-6 pb-20 lg:my-auto lg:px-12 lg:pt-24 lg:pb-0"
      >
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center lg:mx-0 lg:max-w-[40%] lg:items-start lg:text-left">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={slide.key}
              className="flex flex-col items-center lg:items-start"
              initial="hidden"
              animate="show"
              exit="out"
              variants={{
                hidden: {},
                show: {
                  transition: { staggerChildren: 0.08, delayChildren: 0.15 },
                },
                out: { opacity: 0, y: -8, transition: { duration: 0.3 } },
              }}
              aria-live="polite"
            >
              {slide.eyebrow && (
                <Item>
                  <p className="eyebrow mb-4">{slide.eyebrow}</p>
                </Item>
              )}
              <Item>
                <h1 className="font-serif text-[2.75rem] leading-[1.02] font-light text-ivory sm:text-6xl xl:text-[5rem]">
                  {slide.title}
                  {slide.title && slide.highlight && <br />}
                  {slide.highlight && (
                    <em className="text-gold font-normal">{slide.highlight}</em>
                  )}
                </h1>
              </Item>
              {slide.subtitle && (
                <Item>
                  <p className="mt-4 max-w-xs text-sm leading-relaxed text-stone sm:max-w-md lg:text-base">
                    {slide.subtitle}
                  </p>
                </Item>
              )}
              {slide.ctaHref && (
                <Item>
                  <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                    <ButtonLink href={slide.ctaHref} size="lg">
                      {slide.ctaLabel || "Shop now"}
                    </ButtonLink>
                  </div>
                </Item>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Dots, centred */}
      {count > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-10 mx-auto flex max-w-site items-center justify-center px-6 lg:px-12">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => go(i, i > index ? 1 : -1)}
              aria-label={`Show slide ${i + 1}`}
              aria-current={i === index}
              className="pointer-events-auto grid h-6 place-items-center px-1"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-all duration-500",
                  i === index
                    ? "bg-gold w-5"
                    : "w-1.5 bg-ivory/25 hover:bg-ivory/50",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.8, ease } },
      }}
    >
      {children}
    </motion.div>
  );
}
