"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { ButtonLink } from "@/components/ui/button";

const ease = [0.22, 1, 0.36, 1] as const;

function Line({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <span className="block overflow-hidden pb-1">
      <motion.span
        className="block"
        initial={{ y: "110%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 1.1, ease, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/**
 * F1 brand hero. In F7 this becomes the admin-managed hero carousel
 * (slides with images/videos); the layout and motion carry over.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const visualY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "35%"]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      ref={ref}
      className="grain relative isolate flex min-h-[88svh] items-end overflow-hidden bg-ink-950 pt-16 pb-20 lg:min-h-[94vh] lg:items-center lg:pt-24 lg:pb-0"
    >
      {/* Light: slow-rotating golden rays + warm glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-1/2 right-[-30%] size-[150vw] max-w-350 max-h-350 -translate-y-1/2 lg:right-[-10%] lg:size-[85vw]">
          <motion.div
            className="size-full rounded-full opacity-40 blur-2xl mask-[radial-gradient(circle,black_10%,transparent_65%)]"
            style={{
              background:
                "repeating-conic-gradient(from 0deg, rgba(245,215,122,0.35) 0deg 2deg, transparent 2deg 14deg)",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 120, ease: "linear", repeat: Infinity }}
          />
        </div>
        <div className="absolute top-1/2 right-[-10%] size-[90vw] max-w-225 max-h-225 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.28),rgba(184,134,11,0.08)_40%,transparent_70%)] lg:right-[5%] lg:size-[50vw]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-ink-900 to-transparent" />
      </div>

      <div className="mx-auto grid w-full max-w-site grid-cols-1 items-center px-6 lg:grid-cols-2 lg:px-12">
        {/* Visual */}
        <motion.div
          style={{ y: visualY }}
          className="absolute top-[7%] right-[-10%] w-[72%] sm:right-[-4%] sm:w-[55%] lg:relative lg:top-auto lg:right-auto lg:order-2 lg:w-full lg:justify-self-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 1.08, filter: "blur(14px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.8, ease }}
            className="relative mx-auto aspect-4/5 max-w-130 mask-[radial-gradient(ellipse_at_center,black_45%,transparent_72%)]"
          >
            {/* DEMO image — replaced by admin-managed hero slides in F7 */}
            <Image
              src="/demo/watches/aurum-chronograph.webp"
              alt="Gold chronograph on black"
              fill
              priority
              sizes="(min-width: 1024px) 520px, 80vw"
              className="object-cover"
            />
          </motion.div>
        </motion.div>
        {/* Keep copy legible where it overlaps the image on phones */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-ink-950 via-ink-950/80 to-transparent lg:hidden"
        />

        {/* Copy */}
        <motion.div style={{ y: textY, opacity: fade }} className="relative z-10 max-w-xl lg:order-1">
          <motion.p
            className="eyebrow mb-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
          >
            The Luxurious World
          </motion.p>
          <h1 className="font-serif text-[2.75rem] leading-[1.02] font-light text-ivory sm:text-6xl lg:text-[5.5rem]">
            <Line delay={0.3}>Crafted for</Line>
            <Line delay={0.42}>
              <em className="text-gold font-normal">Presence.</em>
            </Line>
          </h1>
          <motion.p
            className="mt-5 max-w-[16rem] text-sm leading-relaxed text-stone sm:max-w-sm lg:text-base"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease, delay: 0.7 }}
          >
            Timepieces, fragrances &amp; leather — curated for those who notice
            every detail.
          </motion.p>
          <motion.div
            className="mt-8 flex flex-wrap items-center gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease, delay: 0.85 }}
          >
            <ButtonLink href="/shop" size="lg">
              Shop now
            </ButtonLink>
            <ButtonLink href="/shop" variant="ghost" className="hidden px-2 sm:inline-flex">
              Explore collections
            </ButtonLink>
          </motion.div>
        </motion.div>
      </div>

      {/* Carousel dots — live once hero slides are admin-managed (F7) */}
      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-2" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={i === 0 ? "bg-gold h-1.5 w-5 rounded-full" : "size-1.5 rounded-full bg-ivory/25"}
          />
        ))}
      </div>
    </section>
  );
}
