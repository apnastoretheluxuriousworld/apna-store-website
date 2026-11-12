"use client";

import { LazyMotion } from "motion/react";

const loadFeatures = () => import("./motion-features").then((m) => m.default);

/**
 * Store pages use the light <m.div> components; the animation engine they need
 * downloads separately, right after the first screen, instead of inside every
 * page's first JavaScript. Use `m` (not `motion`) under this provider.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}
