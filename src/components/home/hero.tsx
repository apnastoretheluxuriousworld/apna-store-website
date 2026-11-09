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
 * Homepage hero carousel: the banners from Admin → Hero banners. Each banner is a
 * landscape (16:9) image shown whole, edge to edge, below the fixed header.
 * Phones: text and button under the image. Desktop: text over the image's left
 * side on a dark fade. Autoplays every 5s (the timer restarts after a swipe or
 * dot tap), swipes on touch, and keys ←/→ when focused.
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
  const visualY = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

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
      className="grain relative isolate overflow-hidden bg-ink-950 pt-16 outline-none lg:pt-24"
    >
      {/* Landscape banner: whole image, full width */}
      <div className="relative aspect-video w-full overflow-hidden lg:max-h-[calc(100svh-6rem)]">
        <motion.div
          style={{ y: visualY }}
          drag={count > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={onDragEnd}
          className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
        >
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div
              key={slide.key}
              custom={dir}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: d * 60, scale: 1.03 }),
                center: { opacity: 1, x: 0, scale: 1 },
                exit: (d: number) => ({ opacity: 0, x: d * -60, scale: 0.98 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.8, ease }}
              className="absolute inset-0 will-change-transform"
            >
              <Image
                src={slide.image}
                alt={[slide.eyebrow, slide.title, slide.highlight]
                  .filter(Boolean)
                  .join(" ")}
                fill
                priority={index === 0}
                draggable={false}
                sizes="100vw"
                className="pointer-events-none object-cover select-none"
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Blend into the page; on desktop also darken the left for the copy */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-linear-to-t from-ink-950 to-transparent lg:h-1/3"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-3/5 bg-linear-to-r from-ink-950/90 via-ink-950/55 to-transparent lg:block"
        />

        {/* Desktop copy, over the image */}
        <motion.div
          style={{ opacity: fade }}
          className="pointer-events-none absolute inset-0 mx-auto hidden w-full max-w-site items-center px-12 lg:flex"
        >
          <div className="max-w-[42%]">
            <Copy slide={slide} desktop />
          </div>
        </motion.div>

        <Dots count={count} index={index} slides={slides} go={go} className="bottom-3 lg:bottom-6" />
      </div>

      {/* Phone copy, under the image */}
      <div className="px-6 pt-4 pb-12 lg:hidden">
        <Copy slide={slide} />
      </div>
    </section>
  );
}

function Copy({ slide, desktop }: { slide: HeroSlide; desktop?: boolean }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={slide.key}
        className={cn(
          "flex flex-col",
          desktop ? "items-start text-left" : "items-center text-center",
        )}
        initial="hidden"
        animate="show"
        exit="out"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
          out: { opacity: 0, y: -8, transition: { duration: 0.3 } },
        }}
        aria-live={desktop ? "polite" : undefined}
      >
        {slide.eyebrow && (
          <Item>
            <p className="eyebrow mb-3 lg:mb-4">{slide.eyebrow}</p>
          </Item>
        )}
        <Item>
          {/* One h1 per page: the phone copy is hidden on desktop and vice versa */}
          <h1 className="font-serif text-[2.25rem] leading-[1.05] font-light text-ivory sm:text-5xl lg:text-6xl xl:text-7xl">
            {slide.title}
            {slide.title && slide.highlight && <br />}
            {slide.highlight && (
              <em className="text-gold font-normal">{slide.highlight}</em>
            )}
          </h1>
        </Item>
        {slide.subtitle && (
          <Item>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-stone lg:mt-4 lg:text-base">
              {slide.subtitle}
            </p>
          </Item>
        )}
        {slide.ctaHref && (
          <Item>
            <div className="pointer-events-auto mt-6 lg:mt-7">
              <ButtonLink href={slide.ctaHref} size="lg">
                {slide.ctaLabel || "Shop now"}
              </ButtonLink>
            </div>
          </Item>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function Dots({
  count,
  index,
  slides,
  go,
  className,
}: {
  count: number;
  index: number;
  slides: HeroSlide[];
  go: (next: number, d: number) => void;
  className?: string;
}) {
  if (count < 2) return null;
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 flex items-center justify-center",
        className,
      )}
    >
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
              i === index ? "bg-gold w-5" : "w-1.5 bg-ivory/30 hover:bg-ivory/60",
            )}
          />
        </button>
      ))}
    </div>
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
