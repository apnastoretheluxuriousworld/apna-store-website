"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Suspense } from "react";
import { Heart, Home, LayoutGrid, Menu, ShoppingBag, X } from "lucide-react";
import { useMenu } from "./menu-context";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Home", href: "/", icon: Home },
  { label: "Shop", href: "/shop", icon: LayoutGrid },
  { label: "Wishlist", href: "/wishlist", icon: Heart },
  { label: "Bag", href: "/cart", icon: ShoppingBag },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

const tabClass = (active: boolean) =>
  cn(
    "relative flex h-full w-full flex-col items-center justify-center gap-1 transition-colors duration-300",
    active ? "text-gold-400" : "text-stone hover:text-ivory",
  );

function Indicator() {
  return (
    <motion.span
      layoutId="tab-indicator"
      className="bg-gold absolute top-0 h-0.5 w-8 rounded-full"
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
    />
  );
}

/** The active-tab highlight needs the URL, so it streams in (Cache Components). */
export function MobileBottomBar() {
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
  const { open, toggle } = useMenu();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gold-500/15 bg-ink-950/90 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-(--bottom-bar-h) max-w-md grid-cols-5">
        {tabs.map(({ label, href, icon: Icon }) => {
          const active = !open && isActive(pathname, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                {active && <Indicator />}
                <Icon
                  className="size-[1.35rem]"
                  strokeWidth={active ? 1.5 : 1.25}
                  fill={active ? "currentColor" : "none"}
                  fillOpacity={active ? 0.9 : 0}
                />
                <span className="text-[0.625rem] tracking-wide">{label}</span>
              </Link>
            </li>
          );
        })}

        <li>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className={tabClass(open)}
          >
            {open && <Indicator />}
            <span className="relative size-[1.35rem]">
              <motion.span
                className="absolute inset-0"
                initial={false}
                animate={{ opacity: open ? 0 : 1, rotate: open ? 90 : 0 }}
                transition={{ duration: 0.25 }}
              >
                <Menu className="size-[1.35rem]" strokeWidth={1.25} />
              </motion.span>
              <motion.span
                className="absolute inset-0"
                initial={false}
                animate={{ opacity: open ? 1 : 0, rotate: open ? 0 : -90 }}
                transition={{ duration: 0.25 }}
              >
                <X className="size-[1.35rem]" strokeWidth={1.5} />
              </motion.span>
            </span>
            <span className="text-[0.625rem] tracking-wide">Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
