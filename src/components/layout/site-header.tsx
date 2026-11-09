"use client";

import Link from "next/link";
import { useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { Heart, Menu, Search, ShoppingBag, User } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { BagBadge } from "@/components/cart/bag-badge";
import { useMenu } from "./menu-context";
import type { NavCategory } from "@/lib/site";
import { cn } from "@/lib/utils";

const iconLinks = [
  { label: "Search", href: "/search", icon: Search },
  { label: "Wishlist", href: "/wishlist", icon: Heart },
  { label: "Account", href: "/account", icon: User },
  { label: "Cart", href: "/cart", icon: ShoppingBag },
];

// Desktop header shows the first 5 collections (admin order); the sidebar lists all.
const HEADER_COUNT = 5;

export function SiteHeader({ categories }: { categories: NavCategory[] }) {
  const { scrollY } = useScroll();
  const { toggle } = useMenu();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 24);
    // Phones: hide while scrolling down, reveal on scroll up. Desktop: always pinned.
    setHidden(y > 160 && y > prev);
  });

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-30 transition-[background-color,translate] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        hidden && "max-lg:-translate-y-full",
        scrolled
          ? "bg-ink-950/95"
          : "bg-linear-to-b from-ink-950/80 to-transparent",
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Mobile: logo only — all navigation lives in the bottom bar */}
      <div className="flex h-16 items-center justify-center px-4 lg:hidden">
        <Logo compact />
      </div>

      {/* Desktop: logo · collections · icons + ☰ */}
      <div className="mx-auto hidden h-24 max-w-site grid-cols-[1fr_auto_1fr] items-center gap-8 px-12 lg:grid">
        <Logo className="justify-self-start" />

        <nav aria-label="Collections" className="flex items-center gap-8 xl:gap-10">
          {categories
            .slice(0, HEADER_COUNT)
            .map((c) => (
              <Link
                key={c.slug}
                href={`/shop/${c.slug}`}
                className="group relative text-[0.7rem] uppercase tracking-[0.25em] text-ivory/80 transition-colors hover:text-gold-300"
              >
                {c.name}
                <span className="bg-gold absolute -bottom-1.5 left-0 h-px w-full origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100" />
              </Link>
            ))}
        </nav>

        <div className="flex items-center justify-self-end gap-6">
          {iconLinks.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className="relative text-ivory/80 transition-colors hover:text-gold-400"
            >
              <Icon className="size-5" strokeWidth={1.25} />
              {href === "/cart" && <BagBadge />}
            </Link>
          ))}
          <span className="h-6 w-px bg-ivory/15" aria-hidden />
          <button
            onClick={toggle}
            aria-label="Open menu"
            aria-controls="site-menu"
            className="group -mr-1 flex items-center gap-2 p-1 text-ivory/80 transition-colors hover:text-gold-400"
          >
            <span className="text-[0.65rem] uppercase tracking-[0.25em]">Menu</span>
            <Menu className="size-6" strokeWidth={1.25} />
          </button>
        </div>
      </div>

      <div
        className={cn(
          "hairline transition-opacity duration-500",
          scrolled ? "opacity-40" : "opacity-0",
        )}
      />
    </header>
  );
}
