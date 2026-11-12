"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type State = "idle" | "loading" | "done";

/**
 * Thin gold line at the top of the screen after a tap on an in-store link,
 * until the new page is showing — so a tap never feels "dead" on a slow
 * network. It waits 120 ms before appearing: prefetched pages open faster than
 * that and never show it. Styles: globals.css, "Navigation progress".
 * Reads the URL, so the layout renders it inside <Suspense>.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [state, setState] = useState<State>("idle");
  const show = useRef<number | undefined>(undefined);
  const giveUp = useRef<number | undefined>(undefined);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page / #hash
      window.clearTimeout(show.current);
      window.clearTimeout(giveUp.current);
      show.current = window.setTimeout(() => setState("loading"), 120);
      // A link whose click handler cancelled the navigation (e.g. a swipe): don't hang around.
      giveUp.current = window.setTimeout(() => setState("idle"), 10_000);
    }
    // Capture phase: next/link cancels the browser's default navigation in its own handler.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // The new URL is showing: finish the line and fade it out.
  useEffect(() => {
    window.clearTimeout(show.current);
    window.clearTimeout(giveUp.current);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the router's URL change
    setState((s) => (s === "loading" ? "done" : "idle"));
    const t = window.setTimeout(() => setState("idle"), 450);
    return () => window.clearTimeout(t);
  }, [pathname, search]);

  return <div aria-hidden className="nav-progress" data-state={state} />;
}
