"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Suspense, useState } from "react";
import { ExternalLink, MoreHorizontal, X } from "lucide-react";
import { Emblem } from "@/components/brand/logo";
import { adminNav, isActive } from "./nav";
import { SignOutButton } from "./sign-out-button";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

/** Mobile top bar (brand + who's signed in). */
export function AdminMobileTop({ userSlot }: { userSlot: React.ReactNode }) {
  return (
    <header
      className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-ink-600/60 bg-ink-950/90 px-4 backdrop-blur-xl lg:hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Link href="/admin" className="flex items-center gap-2.5">
        <Emblem className="h-6" />
        <span className="font-serif text-base tracking-[0.12em] text-ivory uppercase">Admin</span>
      </Link>
      <div className="text-right text-xs">{userSlot}</div>
    </header>
  );
}

/** Mobile bottom bar: 4 primary sections + "More" sheet. Highlight streams in with the URL. */
export function AdminBottomBar() {
  return (
    <Suspense fallback={<BottomBarView pathname="" />}>
      <BottomBarWithPath />
    </Suspense>
  );
}

function BottomBarWithPath() {
  return <BottomBarView pathname={usePathname()} />;
}

function BottomBarView({ pathname }: { pathname: string }) {
  // Open state is tied to the pathname it was opened on, so navigating closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const primary = adminNav.filter((i) => i.primary);
  const more = adminNav.filter((i) => !i.primary);
  const moreActive = more.some((i) => isActive(pathname, i.href));

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenAt(null)}
            />
            <motion.div
              role="dialog"
              aria-label="More"
              className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 rounded-t-2xl border-t border-gold-500/20 bg-ink-850 p-4 lg:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.4, ease }}
            >
              <div className="grid grid-cols-4 gap-2">
                {more.map(({ label, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl py-3 text-[0.7rem]",
                      isActive(pathname, href) ? "bg-gold-500/10 text-gold-300" : "text-stone",
                    )}
                  >
                    <span className="grid size-10 place-items-center rounded-full border border-gold-500/30">
                      <Icon className="size-4.5 text-gold-400" strokeWidth={1.5} />
                    </span>
                    {label}
                  </Link>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-ink-600/60 pt-3">
                <Link
                  href="/"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-stone hover:bg-ink-800"
                >
                  <ExternalLink className="size-4" strokeWidth={1.5} /> View store
                </Link>
                <SignOutButton />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav
        aria-label="Admin"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-gold-500/15 bg-ink-950/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
          {primary.map(({ label, href, icon: Icon }) => {
            const active = !open && isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-1 text-[0.6rem] tracking-wide",
                    active ? "text-gold-400" : "text-stone",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 1.75 : 1.25} />
                  {label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpenAt(open ? null : pathname)}
              aria-expanded={open}
              className={cn(
                "flex h-full w-full flex-col items-center justify-center gap-1 text-[0.6rem] tracking-wide",
                open || moreActive ? "text-gold-400" : "text-stone",
              )}
            >
              {open ? <X className="size-5" strokeWidth={1.5} /> : <MoreHorizontal className="size-5" strokeWidth={1.25} />}
              More
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
