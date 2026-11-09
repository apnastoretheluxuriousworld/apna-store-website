"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ROLE_HINT_COOKIE } from "@/lib/auth/role-hint-cookie";

const KEY = "apna-vid";
/** The page last counted, so the same view is never sent twice (e.g. effects re-running). */
let lastSent: string | null = null;

/** A random id for this browser (no personal data), kept so repeat visits count once a day. */
function visitorId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null; // storage blocked: don't count rather than count every page as a new visitor
  }
}

/** Counts a store page view on every page change (see /api/visit). Renders nothing. */
export function VisitTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (lastSent === pathname) return;
    if (document.cookie.split("; ").includes(`${ROLE_HINT_COOKIE}=admin`)) return;
    const v = visitorId();
    if (!v) return;
    lastSent = pathname;
    const body = JSON.stringify({ v });
    if (!navigator.sendBeacon?.("/api/visit", body)) {
      void fetch("/api/visit", { method: "POST", body, keepalive: true }).catch(() => {});
    }
  }, [pathname]);
  return null;
}
