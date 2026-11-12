"use client";

import { m, type HTMLMotionProps } from "motion/react";

/*
 * These used to fade + lift content in as it scrolled into view. That left
 * blank areas while scrolling and made the store feel slow, so they now render
 * content immediately. Kept as wrappers so the page markup doesn't change.
 */

type RevealProps = HTMLMotionProps<"div"> & { delay?: number; y?: number };

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- old animation props, now ignored
export function Reveal({ delay: _delay, y: _y, ...rest }: RevealProps) {
  return <m.div {...rest} />;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- old animation prop, now ignored
export function RevealGroup({ stagger: _stagger, ...rest }: HTMLMotionProps<"div"> & { stagger?: number }) {
  return <m.div {...rest} />;
}

export function RevealItem(props: HTMLMotionProps<"div">) {
  return <m.div {...props} />;
}
