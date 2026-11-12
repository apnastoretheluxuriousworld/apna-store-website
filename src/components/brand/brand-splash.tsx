"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Full-screen brand moment when the app is opened: the AS emblem and the
 * "Apna Store" wordmark glow in, then the whole screen fades to the page
 * (~1.5 s). The page loads behind it, so it is ready when the splash lifts.
 *
 * Once per app open (per browser tab session): SPLASH_GATE (splash-gate.ts),
 * inlined in the root layout's <head>, hides it before the first paint on
 * refreshes, back/forward and later page loads in the same tab. The timing lives in CSS (globals.css, "Brand
 * splash"), so it plays and ends even before the JavaScript has loaded.
 * A tap skips it.
 */
export function BrandSplash() {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <div
      className="brand-splash"
      aria-hidden
      onClick={() => setGone(true)}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && e.animationName === "splash-out") setGone(true);
      }}
    >
      <span className="brand-splash__glow" />
      {/* Same image props as the header logo, so the browser reuses those files. */}
      <Image src="/brand/logo-emblem.png" alt="" width={590} height={444} priority className="brand-splash__emblem" />
      <span className="brand-splash__line" />
      <Image src="/brand/logo-wordmark.png" alt="" width={1284} height={248} priority className="brand-splash__word" />
    </div>
  );
}

