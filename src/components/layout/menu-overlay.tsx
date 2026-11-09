"use client";

import Link from "next/link";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { useLenis } from "lenis/react";
import { useEffect, useSyncExternalStore } from "react";
import { ArrowUpRight, ChevronRight, Search, User, X } from "lucide-react";
import { useMenu } from "./menu-context";
import { isPlainClick } from "@/lib/use-tapped-path";
import { useAccountHref } from "@/lib/auth/role-hint";
import { Emblem } from "@/components/brand/logo";
import { CategoryIcon } from "@/components/brand/category-icon";
import { ButtonLink } from "@/components/ui/button";
import { secondaryLinks, site, type NavCategory } from "@/lib/site";

const ease = [0.22, 1, 0.36, 1] as const;

const quickLinks = [
  { label: "About Us", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Shipping", href: "/shipping-policy" },
  { label: "Returns", href: "/refund-policy" },
];

function subscribeDesktop(cb: () => void) {
  const mq = window.matchMedia("(min-width: 1024px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useIsDesktop() {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

/** Mobile: compact bottom sheet. Desktop: full right-side sidebar. */
export function MenuOverlay({ categories }: { categories: NavCategory[] }) {
  const { open, shown, close, go, onClosed } = useMenu();
  const lenis = useLenis();
  const desktop = useIsDesktop();

  // Lock background scroll while the sheet is on screen. It unlocks only after
  // the closing animation ends — unlocking mid-slide repaints the page and the
  // fixed bottom bar, which shows as a flash.
  useEffect(() => {
    if (!shown) return;
    lenis?.stop();
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
      lenis?.start();
    };
  }, [shown, lenis]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <AnimatePresence onExitComplete={onClosed}>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            onClick={close}
            aria-hidden
          />
          {desktop ? (
            <DesktopSidebar key="sidebar" onClose={close} onLink={go} categories={categories} />
          ) : (
            <MobileSheet key="sheet" onClose={close} onLink={go} categories={categories} />
          )}
        </>
      )}
    </AnimatePresence>
  );
}

/* ─────────────── Desktop: right sidebar ─────────────── */

const list = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } } };
const item = {
  hidden: { opacity: 0, x: 30 },
  show: { opacity: 1, x: 0, transition: { duration: 0.6, ease } },
};

/** Any link tapped inside the menu closes it at once, while the next page loads. */
const closeOnLink = (onLink: (href: string) => void) => (e: React.MouseEvent) => {
  const a = (e.target as HTMLElement).closest("a[href]");
  const href = a?.getAttribute("href");
  if (href?.startsWith("/") && isPlainClick(e)) onLink(href);
};

type PanelProps = { onClose: () => void; onLink: (href: string) => void; categories: NavCategory[] };

function DesktopSidebar({ onClose, onLink, categories }: PanelProps) {
  return (
    <motion.aside
      onClick={closeOnLink(onLink)}
      id="site-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      data-lenis-prevent
      className="grain fixed inset-y-0 right-0 z-40 flex w-[min(36rem,92vw)] flex-col overflow-y-auto border-l border-gold-500/15 bg-ink-950 shadow-[-30px_0_80px_-20px_rgba(0,0,0,0.9)]"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.7, ease }}
    >
      <div className="relative z-10 flex min-h-full flex-col px-12 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Emblem className="h-9" />
            <span className="eyebrow">{site.tagline}</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="-mr-2 p-2 text-stone transition-colors hover:rotate-90 hover:text-gold-400 duration-500"
          >
            <X className="size-6" strokeWidth={1.25} />
          </button>
        </div>

        <motion.nav variants={list} initial="hidden" animate="show" className="mt-12 flex-1" aria-label="Categories">
          <motion.p variants={item} className="eyebrow mb-5">
            Collections
          </motion.p>
          <ul className="divide-y divide-ink-600/70 border-y border-ink-600/70">
            {categories.map((c, i) => (
              <motion.li key={c.slug} variants={item}>
                <Link href={`/shop/${c.slug}`} className="group flex items-center gap-5 py-3.5">
                  <span className="w-6 text-xs text-mute tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-serif text-[2.6rem] leading-none font-light text-ivory transition-all duration-500 ease-luxe group-hover:translate-x-2 group-hover:text-gold-300">
                    {c.name}
                  </span>
                  <span className="ml-auto text-[0.65rem] uppercase tracking-[0.2em] text-mute opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:text-gold-400">
                    {c.blurb}
                  </span>
                  <ArrowUpRight
                    className="size-5 shrink-0 text-mute transition-all duration-500 group-hover:rotate-45 group-hover:text-gold-400"
                    strokeWidth={1}
                  />
                </Link>
              </motion.li>
            ))}
          </ul>

          <motion.div variants={item} className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4">
            {secondaryLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-xs uppercase tracking-[0.22em] text-stone transition-colors hover:text-gold-400"
              >
                {l.label}
              </Link>
            ))}
          </motion.div>

          <motion.div variants={item} className="mt-10">
            <ButtonLink href="/shop" size="lg">
              Shop all <ArrowUpRight className="size-4" strokeWidth={1.5} />
            </ButtonLink>
          </motion.div>
        </motion.nav>
      </div>
    </motion.aside>
  );
}

/* ─────────────── Mobile: compact bottom sheet ─────────────── */

function MobileSheet({ onClose, onLink, categories }: PanelProps) {
  const accountHref = useAccountHref();
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose();
  };

  return (
    <motion.div
      id="site-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      data-lenis-prevent
      className="fixed inset-x-0 bottom-[calc(var(--bottom-bar-h)+env(safe-area-inset-bottom))] z-40 max-h-[75dvh] overflow-y-auto rounded-t-2xl border-t border-gold-500/20 bg-ink-850 px-5 pt-2 pb-5 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8)]"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ duration: 0.45, ease }}
      onClick={closeOnLink(onLink)}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={onDragEnd}
    >
      <div className="mb-3 flex justify-center">
        <span className="h-1 w-10 rounded-full bg-ivory/20" />
      </div>

      <Link
        href="/search"
        className="flex h-11 items-center gap-3 rounded-lg border border-ink-600 bg-ink-900 px-4 text-sm text-mute transition-colors hover:border-gold-500/40"
      >
        <Search className="size-4 text-gold-400" strokeWidth={1.5} />
        Search watches, bags, perfumes…
      </Link>

      <p className="mt-5 mb-3 text-[0.65rem] font-medium uppercase tracking-[0.22em] text-ivory/80">
        Collections
      </p>
      <motion.ul
        className="grid grid-cols-4 gap-x-2 gap-y-4"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.03, delayChildren: 0.15 } } }}
      >
        {categories.map((c) => (
          <motion.li key={c.slug} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
            <Link href={`/shop/${c.slug}`} className="group flex flex-col items-center gap-1.5">
              <span className="grid size-12 place-items-center rounded-full border border-gold-500/40 bg-ink-900 transition-all duration-300 group-hover:border-gold-300 group-active:scale-95">
                <CategoryIcon slug={c.slug} className="size-5 text-gold-400" strokeWidth={1.1} />
              </span>
              <span className="text-[0.65rem] text-ivory/80 group-hover:text-gold-300">{c.name}</span>
            </Link>
          </motion.li>
        ))}
      </motion.ul>

      <div className="hairline my-5 opacity-30" />

      <Link
        href={accountHref}
        className="flex items-center gap-3 rounded-lg bg-ink-900 px-4 py-3 transition-colors hover:bg-ink-800"
      >
        <span className="grid size-9 place-items-center rounded-full border border-gold-500/40">
          <User className="size-4 text-gold-400" strokeWidth={1.5} />
        </span>
        <span className="flex-1">
          <span className="block text-sm text-ivory">My Account</span>
          <span className="block text-[0.7rem] text-mute">Orders, addresses &amp; profile</span>
        </span>
        <ChevronRight className="size-4 text-mute" strokeWidth={1.5} />
      </Link>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {quickLinks.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs text-stone transition-colors hover:bg-ink-900 hover:text-gold-300"
            >
              {l.label}
              <ChevronRight className="size-3.5" strokeWidth={1.5} />
            </Link>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
