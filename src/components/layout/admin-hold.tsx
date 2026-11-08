"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const HOLD_MS = 2000;

/**
 * Hidden admin entrance: press and hold the footer logo for 2 s → /admin/login.
 * A plain tap does nothing; moving the finger (scrolling) cancels. A thin gold
 * ring fills while holding. Not a security measure — /admin is protected by login.
 */
export function AdminHold({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const start = useRef<{ x: number; y: number }>(undefined);

  function cancel() {
    clearTimeout(timer.current);
    start.current = undefined;
    setHolding(false);
  }

  return (
    <span
      className="relative inline-grid touch-manipulation select-none place-items-center [-webkit-touch-callout:none]"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        start.current = { x: e.clientX, y: e.clientY };
        setHolding(true);
        router.prefetch("/admin/login");
        timer.current = setTimeout(() => {
          cancel();
          navigator.vibrate?.(30);
          router.push("/admin/login");
        }, HOLD_MS);
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
      <svg
        aria-hidden
        viewBox="0 0 40 40"
        className="pointer-events-none absolute -inset-2 size-[calc(100%+1rem)] -rotate-90 overflow-visible"
      >
        <circle
          cx="20"
          cy="20"
          r="19"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={holding ? 0 : 1}
          className="text-gold-400"
          style={{
            opacity: holding ? 1 : 0,
            transition: holding
              ? `stroke-dashoffset ${HOLD_MS}ms linear, opacity 150ms`
              : "stroke-dashoffset 0ms, opacity 150ms",
          }}
        />
      </svg>
    </span>
  );
}
