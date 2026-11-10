"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useSyncExternalStore } from "react";
import { healScrollLock, setScrollLockLenis } from "./scroll-lock";

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Jump to top on route change (Lenis keeps its own scroll position), and make sure the page isn't left frozen. */
function ScrollReset() {
  const pathname = usePathname();
  const lenis = useLenis();
  useEffect(() => {
    healScrollLock();
    lenis?.scrollTo(0, { immediate: true, force: true });
  }, [pathname, lenis]);
  return null;
}

/** Hands the current Lenis to the scroll lock; re-checks the lock when the page comes back into view. */
function ScrollLockBridge() {
  const lenis = useLenis();
  useEffect(() => {
    setScrollLockLenis(lenis ?? null);
    return () => setScrollLockLenis(null);
  }, [lenis]);
  useEffect(() => {
    const heal = () => healScrollLock();
    window.addEventListener("pageshow", heal);
    document.addEventListener("visibilitychange", heal);
    return () => {
      window.removeEventListener("pageshow", heal);
      document.removeEventListener("visibilitychange", heal);
    };
  }, []);
  return null;
}

/** Phones/tablets scroll natively; Lenis ignores touch completely so it can never block a swipe. */
const ignoreTouch = ({ event }: { event: Event }) => !event.type.startsWith("touch");

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduced = usePrefersReducedMotion();
  if (reduced)
    return (
      <>
        <ScrollLockBridge />
        {children}
      </>
    );

  return (
    <ReactLenis
      root
      options={{ lerp: 0.12, smoothWheel: true, syncTouch: false, virtualScroll: ignoreTouch }}
    >
      <ScrollLockBridge />
      <Suspense fallback={null}>
        <ScrollReset />
      </Suspense>
      {children}
    </ReactLenis>
  );
}
