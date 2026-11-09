"use client";

import { usePathname } from "next/navigation";
import { createContext, startTransition, Suspense, use, useCallback, useEffect, useMemo, useState } from "react";

type MenuState = {
  open: boolean;
  /** True from opening until the closing animation has finished (the sheet is on screen). */
  shown: boolean;
  /** The menu's exit animation finished. */
  onClosed: () => void;
  toggle: () => void;
  close: () => void;
  /**
   * Close right now, not as a transition. For taps on links: a transition close
   * would be batched with the navigation and wait until the next page is ready.
   */
  closeNow: () => void;
  /** A link was tapped: close the menu now and treat `href` as the current page until the URL changes. */
  go: (href: string) => void;
  /** The tapped link's href while its page is on the way, else null. */
  pending: string | null;
};

const MenuContext = createContext<MenuState | null>(null);

/** Closes the menu whenever the route changes (incl. back/forward). */
function CloseOnNavigate({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    onNavigate();
  }, [pathname, onNavigate]);
  return null;
}

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // Stays true until the sheet's exit animation finishes (cleared by onClosed).
  const [visible, setVisible] = useState(false);
  // Transitions: a tap right after load can't force still-hydrating
  // <Suspense> boundaries (bottom bar, etc.) into client rendering (React #412).
  const toggle = useCallback(
    () =>
      startTransition(() => {
        setOpen((o) => !o);
        setVisible(true);
      }),
    [],
  );
  const close = useCallback(() => startTransition(() => setOpen(false)), []);
  const closeNow = useCallback(() => setOpen(false), []);
  const [pending, setPending] = useState<string | null>(null);
  const go = useCallback((href: string) => {
    setOpen(false);
    setPending(href);
  }, []);
  const onNavigate = useCallback(() => {
    close();
    setPending(null);
  }, [close]);
  const onClosed = useCallback(() => setVisible(false), []);

  const shown = open || visible;
  const value = useMemo(
    () => ({ open, shown, onClosed, toggle, close, closeNow, go, pending }),
    [open, shown, onClosed, toggle, close, closeNow, go, pending],
  );
  return (
    <MenuContext value={value}>
      {/* Reading the URL must stream (Cache Components), so it sits in Suspense */}
      <Suspense fallback={null}>
        <CloseOnNavigate onNavigate={onNavigate} />
      </Suspense>
      {children}
    </MenuContext>
  );
}

export function useMenu() {
  const ctx = use(MenuContext);
  if (!ctx) throw new Error("useMenu must be used inside <MenuProvider>");
  return ctx;
}
