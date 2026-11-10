"use client";

import { useEffect } from "react";
import type Lenis from "lenis";

/*
 * The one place that freezes page scrolling (store menu, full-screen feed
 * player…). Locks are counted, so two overlays can't undo each other, and the
 * page is never left frozen: healScrollLock() — run on every store page change,
 * when the tab comes back and when the smooth-scroll instance changes — clears
 * any leftover lock whenever nothing is actually open.
 *
 * Freezing = `overflow: hidden` on <html> (phones, native scroll) + stopping
 * Lenis (desktop wheel smoothing). A stopped Lenis cancels every wheel/touch
 * and adds `lenis-stopped` (overflow: clip), so it must never stay stopped.
 */

let locks = 0;
let lenis: Lenis | null = null;

function apply() {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (locks > 0) {
    html.style.overflow = "hidden";
    lenis?.stop();
  } else {
    html.style.removeProperty("overflow");
    html.classList.remove("lenis-stopped");
    lenis?.start();
  }
}

/** SmoothScroll registers the current Lenis instance (null when it goes away). */
export function setScrollLockLenis(instance: Lenis | null) {
  lenis = instance;
  apply();
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
