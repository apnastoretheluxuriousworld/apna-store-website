"use client";

import { usePathname } from "next/navigation";
import { createContext, startTransition, Suspense, use, useCallback, useEffect, useMemo, useState } from "react";

type MenuState = {
  open: boolean;
  toggle: () => void;
  close: () => void;
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
  // Transitions: a tap right after load can't force still-hydrating
  // <Suspense> boundaries (bottom bar, etc.) into client rendering (React #412).
  const toggle = useCallback(() => startTransition(() => setOpen((o) => !o)), []);
  const close = useCallback(() => startTransition(() => setOpen(false)), []);

  const value = useMemo(() => ({ open, toggle, close }), [open, toggle, close]);
  return (
    <MenuContext value={value}>
      {/* Reading the URL must stream (Cache Components), so it sits in Suspense */}
      <Suspense fallback={null}>
        <CloseOnNavigate onNavigate={close} />
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
