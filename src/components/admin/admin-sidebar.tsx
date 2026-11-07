"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { motion } from "motion/react";
import { ExternalLink } from "lucide-react";
import { Emblem } from "@/components/brand/logo";
import { adminNav, isActive } from "./nav";
import { SignOutButton } from "./sign-out-button";
import { cn } from "@/lib/utils";

/** Desktop (lg+) fixed sidebar. The active highlight needs the URL, so it streams in. */
export function AdminSidebar({ userSlot }: { userSlot: React.ReactNode }) {
  return (
    <Suspense fallback={<SidebarView userSlot={userSlot} pathname={null} />}>
      <SidebarWithPath userSlot={userSlot} />
    </Suspense>
  );
}

function SidebarWithPath({ userSlot }: { userSlot: React.ReactNode }) {
  return <SidebarView userSlot={userSlot} pathname={usePathname()} />;
}

function SidebarView({ userSlot, pathname }: { userSlot: React.ReactNode; pathname: string | null }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-600/60 bg-ink-950 lg:flex">
      <Link href="/admin" className="flex items-center gap-3 px-6 pt-7 pb-8">
        <Emblem className="h-8" />
        <span>
          <span className="block font-serif text-lg leading-none tracking-[0.12em] text-ivory uppercase">
            Apna Store
          </span>
          <span className="mt-1 block text-[0.55rem] uppercase tracking-[0.3em] text-gold-400">Admin</span>
        </span>
      </Link>

      <nav aria-label="Admin" className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {adminNav.map(({ label, href, icon: Icon }) => {
          const active = pathname !== null && isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active ? "text-gold-300" : "text-stone hover:bg-ink-800/70 hover:text-ivory",
              )}
            >
              {active && (
                <motion.span
                  layoutId="admin-nav-active"
                  className="absolute inset-0 rounded-lg border border-gold-500/20 bg-gold-500/10"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <Icon className="relative size-4.5" strokeWidth={1.5} />
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-ink-600/60 p-3">
        {userSlot}
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-stone transition-colors hover:bg-ink-800 hover:text-ivory"
        >
          <ExternalLink className="size-4" strokeWidth={1.5} />
          View store
        </Link>
        <SignOutButton />
      </div>
    </aside>
  );
}
