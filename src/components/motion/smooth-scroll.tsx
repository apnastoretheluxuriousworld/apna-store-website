"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";
import { healScrollLock } from "./scroll-lock";

/** On every page change, make sure the page isn't left frozen by an overlay. */
function HealOnRouteChange() {
  const pathname = usePathname();
  useEffect(() => healScrollLock(), [pathname]);
  return null;
}

/**
 * Native browser scrolling (no JS smoothing — it made scrolling feel laggy).
 * Only keeps the scroll lock honest: re-checks it on route changes and when the
 * page comes back into view.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const heal = () => healScrollLock();
    window.addEventListener("pageshow", heal);
    document.addEventListener("visibilitychange", heal);
    return () => {
      window.removeEventListener("pageshow", heal);
      document.removeEventListener("visibilitychange", heal);
    };
  }, []);
  return (
    <>
      <Suspense fallback={null}>
        <HealOnRouteChange />
      </Suspense>
      {children}
    </>
  );
}
