"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Loaded in its own file after the page is idle: it pulls in the realtime client,
// which nothing on the first screen needs.
const ReplyWatcher = dynamic(() => import("@/components/feedback/reply-watcher").then((m) => m.ReplyWatcher), { ssr: false });

/**
 * Background helpers that don't draw anything on the first screen. They start
 * once the browser is idle (at most ~3 s after load), so their code never
 * competes with the page's own JavaScript.
 */
export function IdleExtras() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(() => setReady(true), 1500); // Safari: no requestIdleCallback
    return () => clearTimeout(t);
  }, []);
  if (!ready) return null;
  return (
    <>
      {/* Signed-in customers: toast when the store replies to their feedback */}
      <ReplyWatcher />
    </>
  );
}
