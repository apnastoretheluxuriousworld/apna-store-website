"use client";

import { useEffect } from "react";

/*
 * The one place that freezes page scrolling (store menu, full-screen feed
 * player…). Locks are counted, so two overlays can't undo each other, and the
 * page is never left frozen: healScrollLock() — run on every store page change
 * and when the tab comes back — clears any leftover lock whenever nothing is
 * actually open. Freezing = `overflow: hidden` on <html>.
 */

let locks = 0;

function apply() {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (locks > 0) html.style.overflow = "hidden";
  else html.style.removeProperty("overflow");
}

/** Re-apply the real state: unfreezes the page if nothing is open. */
export function healScrollLock() {
  apply();
}

/** Freeze page scrolling while `active` (e.g. an overlay is on screen). */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    locks += 1;
    apply();
    return () => {
      locks = Math.max(0, locks - 1);
      apply();
    };
  }, [active]);
}
