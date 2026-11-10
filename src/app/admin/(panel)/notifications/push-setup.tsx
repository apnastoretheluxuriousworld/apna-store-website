"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing, Download, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";
import { promptInstall, registerServiceWorker, useCanInstall } from "@/components/admin/pwa";
import { Card } from "@/components/admin/ui";
import { sendTestPush, subscribePush, unsubscribePush } from "./actions";

/*
 * "Phone notifications" card: turns native (web push) notifications on/off
 * for THIS device. iPhone/iPad only allow it from the app added to the Home
 * Screen, so there it first explains how to add it.
 */

type Status = "loading" | "unsupported" | "ios-install" | "blocked" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Does this existing subscription use the server's current key? (Keys can change, e.g. after rotating them.) */
function sameKey(sub: PushSubscription, key: Uint8Array) {
  const k = sub.options.applicationServerKey;
  if (!k) return false;
  const a = new Uint8Array(k);
  return a.length === key.length && a.every((b, i) => b === key[i]);
}

/** Turns a browser push error into something the admin can act on. */
function pushErrorMessage(e: unknown) {
  const name = e instanceof DOMException ? e.name : "";
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "no service worker") return "Couldn't start the app's background worker. Reload the page and try again.";
  if (name === "NotAllowedError") return "Notifications are blocked for this site. Allow them in the browser's site settings.";
  if (name === "InvalidAccessError" || /applicationServerKey|key/i.test(msg))
    return "The server's push key looks invalid. Check VAPID_PUBLIC_KEY in Vercel (no quotes or spaces).";
  if (name === "AbortError" || /push service/i.test(msg))
    return "This browser can't receive push notifications. Use Chrome or Samsung Internet (in Brave: Settings → Privacy → turn on \"Use Google services for push messaging\").";
  return `Couldn't turn on notifications on this device (${name || "error"}: ${msg.slice(0, 120)}).`;
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function deviceName() {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${os} · ${browser}${isStandalone() ? " (app)" : ""}`;
}

export function PushSetup({ vapidKey }: { vapidKey: string | null }) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const canInstall = useCanInstall();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      let next: Status;
      if (!supported) next = isIOS() && !isStandalone() ? "ios-install" : "unsupported";
      else if (Notification.permission === "denied") next = "blocked";
      else {
        const reg = await registerServiceWorker();
        const sub = await reg?.pushManager.getSubscription();
        // A subscription made with an older key can't receive anything: show "off" so it gets renewed.
        if (sub && Notification.permission === "granted" && (!vapidKey || sameKey(sub, urlBase64ToUint8Array(vapidKey)))) {
          setEndpoint(sub.endpoint);
          // Re-save: keeps the server in step if the row was removed (e.g. DB reset).
          void subscribePush(sub.toJSON(), deviceName());
          next = "on";
        } else next = "off";
      }
      if (!cancelled) setStatus(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  const turnOn = useCallback(async () => {
    if (!vapidKey) return;
    setBusy(true);
    try {
      // Must be asked straight from the tap (iOS ignores it otherwise).
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = (await registerServiceWorker()) && (await navigator.serviceWorker.ready);
      if (!reg) throw new Error("no service worker");
      const key = urlBase64ToUint8Array(vapidKey);
      let sub = await reg.pushManager.getSubscription();
      // An old subscription made with an earlier key can't receive anything now: replace it.
      if (sub && !sameKey(sub, key)) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const res = await subscribePush(sub.toJSON(), deviceName());
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEndpoint(sub.endpoint);
      setStatus("on");
      const test = await sendTestPush(sub.endpoint);
      if (!test.ok) toast.error(test.error);
    } catch (e) {
      console.error("[push] subscribe", e);
      toast.error(pushErrorMessage(e), { duration: 12000 });
    } finally {
      setBusy(false);
    }
  }, [vapidKey]);

  const turnOff = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      const ep = sub?.endpoint ?? endpoint;
      await sub?.unsubscribe();
      if (ep) await unsubscribePush(ep);
      setEndpoint(null);
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }, [endpoint]);

  const test = useCallback(async () => {
    if (!endpoint) return;
    setBusy(true);
    const res = await sendTestPush(endpoint);
    setBusy(false);
    if (res.ok) toast.success("Test sent. It should pop up in a moment.");
    else toast.error(res.error);
  }, [endpoint]);

  if (status === "loading") return <div className="h-[5.5rem] animate-pulse rounded-xl bg-ink-850" aria-hidden />;

  const btn = "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs disabled:opacity-50";
  const primary = `${btn} bg-gold font-medium text-ink-950 hover:brightness-110`;
  const secondary = `${btn} border border-ink-600 text-stone hover:border-gold-500/40 hover:text-ivory`;

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-500/15 text-gold-300">
        {status === "on" ? <BellRing className="size-5" strokeWidth={1.5} /> : <Bell className="size-5" strokeWidth={1.5} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ivory">
          Phone notifications{status === "on" && <span className="ml-2 text-xs font-normal text-emerald-400">On for this device</span>}
        </p>
        <p className="mt-0.5 text-xs text-mute">
          {!vapidKey
            ? "Not set up on the server yet (VAPID keys missing)."
            : status === "ios-install"
              ? (
                <>
                  On iPhone, first add the app to your Home Screen: tap <Share className="inline size-3.5 align-[-2px]" /> Share, then{" "}
                  <SquarePlus className="inline size-3.5 align-[-2px]" /> Add to Home Screen. Open it from there and come back to this page.
                </>
              )
              : status === "unsupported"
                ? "This browser can't show notifications. Use Chrome, Safari or Edge."
                : status === "blocked"
                  ? "Notifications are blocked for this site. Allow them in your browser or phone settings, then reload."
                  : status === "on"
                    ? "New orders, payments, reviews and messages pop up even when the app is closed."
                    : "Get new orders, payments, reviews and messages as notifications, even when the app is closed."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {canInstall && (
          <button type="button" onClick={() => void promptInstall()} className={secondary}>
            <Download className="size-4" /> Install app
          </button>
        )}
        {vapidKey && status === "off" && (
          <button type="button" onClick={turnOn} disabled={busy} className={primary}>
            <Bell className="size-4" /> {busy ? "Turning on…" : "Turn on"}
          </button>
        )}
        {status === "on" && (
          <>
            <button type="button" onClick={test} disabled={busy} className={secondary}>
              Send test
            </button>
            <button type="button" onClick={turnOff} disabled={busy} className={secondary}>
              Turn off
            </button>
          </>
        )}
      </div>
    </Card>
  );
}
