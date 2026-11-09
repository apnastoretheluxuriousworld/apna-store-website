"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fetchNotifications, markNotificationsRead, refreshAdminPages } from "@/app/admin/(panel)/notifications/actions";
import type { AdminNotification } from "@/lib/data/notifications";
import { subscribeAdminSignals } from "@/lib/realtime/client";
import { cn } from "@/lib/utils";

/*
 * Admin notifications, live.
 * - On load: the latest 50 + unread count.
 * - Realtime signal (Supabase broadcast, see lib/realtime) → check for news at once.
 * - Backup check every 60 s (every 20 s when realtime isn't connected), and
 *   whenever the tab comes back into view.
 * - Something new → toast + chime, and the admin's cached pages refresh.
 */

const LIVE_CHECK_MS = 60_000;
const FALLBACK_CHECK_MS = 20_000;
const EPOCH = new Date(0).toISOString();
const SOUND_KEY = "apna-admin-sound";

type State = {
  items: AdminNotification[];
  unread: number;
  loaded: boolean;
  /** Realtime connected (else: periodic checks only). */
  live: boolean;
  sound: boolean;
  setSound: (on: boolean) => void;
  markRead: (ids: string[]) => void;
  markAllRead: () => void;
  open: (n: AdminNotification) => void;
};

const Ctx = createContext<State | null>(null);
export const useNotifications = () => useContext(Ctx);

function readSoundPref() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

let audio: AudioContext | null = null;
/** Short two-note chime, made in the browser (no sound file to load). */
function chime() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const t = audio.currentTime;
    for (const [i, freq] of [880, 1318.5].entries()) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = t + i * 0.14;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    }
  } catch {
    /* audio blocked until the admin interacts with the page — the toast still shows */
  }
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [live, setLive] = useState(false);
  const [sound, setSoundState] = useState(true);

  const newest = useRef<string | null>(null);
  /** id → createdAt: a grouped notification moved to the top (new chat message) counts as new again. */
  const known = useRef(new Map<string, string>());
  const busy = useRef(false);
  const again = useRef(false);
  const soundRef = useRef(true);

  useEffect(() => {
    const on = readSoundPref();
    soundRef.current = on;
    setSoundState(on); // eslint-disable-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
  }, []);

  const setSound = useCallback((on: boolean) => {
    soundRef.current = on;
    setSoundState(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    } catch {
      /* private mode: preference lasts for this visit */
    }
    if (on) chime();
  }, []);

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // A check that was already in flight when the admin marked something read
  // brings back an outdated unread count: don't let it undo the change.
  const marking = useRef(0);
  const markVersion = useRef(0);
  const sendMark = useCallback((ids: string[] | "all") => {
    marking.current++;
    markVersion.current++;
    void markNotificationsRead(ids)
      .catch(() => {})
      .finally(() => marking.current--);
  }, []);

  const markRead = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const set = new Set(ids);
    const newlyRead = itemsRef.current.filter((n) => set.has(n.id) && !n.read).length;
    if (newlyRead) setUnread((u) => Math.max(0, u - newlyRead));
    setItems((prev) => prev.map((n) => (set.has(n.id) ? { ...n, read: true } : n)));
    sendMark(ids);
  }, [sendMark]);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    sendMark("all");
  }, [sendMark]);

  const open = useCallback(
    (n: AdminNotification) => {
      if (!n.read) markRead([n.id]);
      router.push(n.href);
    },
    [markRead, router],
  );

  const announce = useCallback(
    (all: AdminNotification[]) => {
      // Already looking at it (e.g. that customer's chat): no toast.
      const fresh = all.filter((n) => n.href !== window.location.pathname);
      if (!fresh.length) return;
      if (soundRef.current) chime();
      const show = fresh.length > 3 ? [] : fresh;
      for (const n of show) {
        toast(n.title, {
          description: n.body ?? undefined,
          duration: 8000,
          action: { label: "View", onClick: () => open(n) },
        });
      }
      if (!show.length) {
        toast(`${fresh.length} new notifications`, {
          duration: 8000,
          action: { label: "View", onClick: () => router.push("/admin/notifications") },
        });
      }
    },
    [open, router],
  );

  const fetchOnce = useCallback(async () => {
    const first = newest.current === null;
    const version = markVersion.current;
    try {
      const res = await fetchNotifications(first ? undefined : newest.current);
      if (!res.ok) return;
      const { unread: count, items: got } = res.data;
      const fresh = got.filter((n) => known.current.get(n.id) !== n.createdAt);
      if (marking.current === 0 && markVersion.current === version) setUnread(count);
      else setUnread((u) => u + fresh.filter((n) => !n.read).length);
      for (const n of got) known.current.set(n.id, n.createdAt);
      newest.current = got[0]?.createdAt ?? newest.current ?? EPOCH;
      if (fresh.length) {
        const freshIds = new Set(fresh.map((n) => n.id));
        setItems((prev) =>
          [...fresh, ...prev.filter((n) => !freshIds.has(n.id))].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100),
        );
        if (!first) {
          announce(fresh);
          void refreshAdminPages(); // after the toast: cached admin pages pick up the new data
        }
      }
      if (first) setLoaded(true);
    } catch {
      /* offline — try again on the next check */
    }
  }, [announce]);

  /** One check at a time; a signal arriving mid-check runs one more afterwards. */
  const check = useCallback(async () => {
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      do {
        again.current = false;
        await fetchOnce();
      } while (again.current);
    } finally {
      busy.current = false;
    }
  }, [fetchOnce]);

  // First load + realtime subscription.
  useEffect(() => {
    void check();
    const unsubscribe = subscribeAdminSignals(
      () => void check(),
      (on) => {
        setLive(on);
        if (on) void check(); // catch up on anything missed while disconnected
      },
    );
    return () => unsubscribe?.();
  }, [check]);

  // Backup checks while the tab is visible, and on coming back to it.
  useEffect(() => {
    const every = live ? LIVE_CHECK_MS : FALLBACK_CHECK_MS;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, every);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live, check]);

  // Number on the installed app's icon (where supported), cleared once all are read.
  useEffect(() => {
    if (!loaded) return;
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    (unread ? nav.setAppBadge?.(unread) : nav.clearAppBadge?.())?.catch(() => {});
  }, [loaded, unread]);

  const value = useMemo<State>(
    () => ({ items, unread, loaded, live, sound, setSound, markRead, markAllRead, open }),
    [items, unread, loaded, live, sound, setSound, markRead, markAllRead, open],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Unread count for the menu (nothing when all read). */
export function UnreadBadge({ className }: { className?: string }) {
  const n = useNotifications()?.unread ?? 0;
  if (!n) return null;
  return (
    <span
      aria-label={`${n} unread`}
      className={cn(
        "grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[0.65rem] font-semibold text-white tabular-nums",
        className,
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
