"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * <Link> that fully prefetches its page (data included) as soon as the visitor
 * shows intent: mouse hover, keyboard focus, or a finger touching down on a
 * phone. The tap itself takes ~100–200 ms, so the page is usually ready when
 * it opens. Before intent it keeps Next's default ('auto' = the route's shared
 * App Shell only), so a page full of product cards doesn't query the server
 * for every card.
 * Pattern from node_modules/next/dist/docs/01-app/02-guides/prefetching.md.
 */
export function IntentLink({ onMouseEnter, onTouchStart, onFocus, ...props }: ComponentProps<typeof Link>) {
  const [active, setActive] = useState(false);
  return (
    <Link
      {...props}
      prefetch={active ? true : "auto"}
      onMouseEnter={(e) => {
        setActive(true);
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        setActive(true);
        onTouchStart?.(e);
      }}
      onFocus={(e) => {
        setActive(true);
        onFocus?.(e);
      }}
    />
  );
}
