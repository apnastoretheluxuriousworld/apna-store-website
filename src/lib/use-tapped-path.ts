"use client";

import { useState } from "react";

/**
 * Makes navigation feel instant: the link the visitor just tapped counts as the
 * current page right away (tab highlight, menu state), before the next page has
 * arrived. Once the URL actually changes the real pathname takes over again.
 * Returns the path to highlight and a function to call with the tapped href.
 */
export function useTappedPath<P extends string | null>(pathname: P) {
  const [tapped, setTapped] = useState<string | null>(null);
  const [seen, setSeen] = useState(pathname);
  if (seen !== pathname) {
    setSeen(pathname);
    setTapped(null);
  }
  const current: string | P = tapped ?? pathname;
  return [current, setTapped] as const;
}

/** A normal tap/click that navigates this tab (not ⌘/Ctrl/Shift-click into a new tab). */
export function isPlainClick(e: React.MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
