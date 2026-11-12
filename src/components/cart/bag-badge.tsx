"use client";

import { AnimatePresence, m } from "motion/react";
import { cn } from "@/lib/utils";
import { useCartCount } from "./cart-store";

/** Gold bubble with the number of pieces in the bag (hidden when empty). */
export function BagBadge({ className }: { className?: string }) {
  const n = useCartCount();
  return (
    <AnimatePresence>
      {n > 0 && (
        <m.span
          key={n}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className={cn(
            "bg-gold absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.6rem] leading-none font-semibold text-ink-950 tabular-nums",
            className,
          )}
          aria-label={`${n} in bag`}
        >
          {n > 99 ? "99+" : n}
        </m.span>
      )}
    </AnimatePresence>
  );
}
