"use client";

import { useEffect, useSyncExternalStore } from "react";

/*
 * Admin app (PWA) plumbing, mounted once in the admin layout:
 * - registers the service worker (/sw.js) that shows push notifications;
 * - keeps Chrome/Android's "Install app" prompt so a button can show it later
 *   (the browser fires it once, early, often before that button is on screen).
 */

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the mini-infobar
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

/** Chrome/Edge/Android: true when the browser can install the app from a button. */
export function useCanInstall() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => deferred !== null,
    () => false,
  );
}

export async function promptInstall() {
  const e = deferred;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  deferred = null;
  emit();
  return outcome === "accepted";
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((e) => {
    console.warn("[sw] register failed", e);
    return null;
  });
}

export function PwaSetup() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
