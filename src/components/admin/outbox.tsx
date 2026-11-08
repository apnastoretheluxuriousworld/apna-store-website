"use client";

/**
 * Optimistic saving for the admin.
 *
 * A save/delete is put in an "outbox" kept in this browser (localStorage), the
 * UI updates at once, and the outbox sends it to the server in the background,
 * one job at a time and in order. If the network drops or the tab closes, the
 * job is still there and is sent the next time the admin is open.
 *
 * Server actions are idempotent for this: creates carry an id generated here,
 * so a retry of a save that actually went through updates instead of duplicating.
 *
 * - Network error / server unreachable → kept, retried with backoff and on "online".
 * - Server says no (validation, conflict) → marked failed; the status pill offers
 *   Retry, Edit (open the form with the unsaved values) or Discard.
 */
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw, X } from "lucide-react";
import { deleteProduct, saveProduct } from "@/app/admin/(panel)/products/actions";
import { deleteCategory, saveCategory } from "@/app/admin/(panel)/categories/actions";
import { deleteFeedVideo, saveFeedVideo } from "@/app/admin/(panel)/feed/actions";
import { deleteHeroSlide, saveHeroSlide } from "@/app/admin/(panel)/hero/actions";
import { savePaymentSettings, saveStoreInfo } from "@/app/admin/(panel)/settings/actions";
import { deleteCoupon, saveCoupon } from "@/app/admin/(panel)/coupons/actions";
import { deleteInfluencer, saveInfluencer } from "@/app/admin/(panel)/influencers/actions";
import { cn } from "@/lib/utils";

type Result = { ok: boolean; error?: string };

const runners = {
  "product.save": (p: unknown) => saveProduct(p),
  "product.delete": (p: unknown) => deleteProduct(p as string),
  "category.save": (p: unknown) => saveCategory(p),
  "category.delete": (p: unknown) => deleteCategory(p as string),
  "feed.save": (p: unknown) => saveFeedVideo(p),
  "feed.delete": (p: unknown) => deleteFeedVideo(p),
  "hero.save": (p: unknown) => saveHeroSlide(p),
  "hero.delete": (p: unknown) => deleteHeroSlide(p),
  "settings.store": (p: unknown) => saveStoreInfo(p),
  "settings.payments": (p: unknown) => savePaymentSettings(p),
  "coupon.save": (p: unknown) => saveCoupon(p),
  "coupon.delete": (p: unknown) => deleteCoupon(p),
  "influencer.save": (p: unknown) => saveInfluencer(p),
  "influencer.delete": (p: unknown) => deleteInfluencer(p),
} satisfies Record<string, (payload: unknown) => Promise<Result>>;

export type JobKind = keyof typeof runners;

export type Job = {
  id: string;
  kind: JobKind;
  /** The product/category this job is about. */
  entityId: string;
  /** Shown in the status pill, e.g. the product name. */
  label: string;
  /** Sent to the server action as-is. */
  payload: unknown;
  /** The form's own values, so reopening the form shows the unsaved edit. */
  formValues?: unknown;
  /** Partial list row, so lists show the change before the server confirms. */
  preview?: Record<string, unknown>;
  /** Where "Edit" goes when the server rejects the save. */
  editHref?: string;
  status: "pending" | "failed";
  error?: string;
  createdAt: number;
};

const KEY = "apna-admin-outbox-v1";
let jobs: Job[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const syncedListeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) jobs = JSON.parse(raw);
  } catch {
    jobs = [];
  }
}

function commit(next: Job[]) {
  jobs = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(jobs));
  } catch {
    /* storage full or blocked — the in-memory queue still works for this visit */
  }
  listeners.forEach((l) => l());
}

const EMPTY: Job[] = [];
function subscribe(l: () => void) {
  load();
  listeners.add(l);
  return () => listeners.delete(l);
}

/** All queued jobs (pending + failed). Re-renders when the queue changes. */
export function useOutbox(): Job[] {
  return useSyncExternalStore(
    subscribe,
    () => (load(), jobs),
    () => EMPTY,
  );
}

/** The latest unsent save for an entity, if any (to show unsaved values in a form). */
export function pendingSave(entityId: string): Job | undefined {
  load();
  return [...jobs].reverse().find((j) => j.entityId === entityId && j.kind.endsWith(".save"));
}

/** Queue a change. The UI should already show it; this sends it in the background. */
export function enqueue(job: Omit<Job, "id" | "status" | "createdAt">) {
  load();
  commit([...jobs, { ...job, id: crypto.randomUUID(), status: "pending", createdAt: Date.now() }]);
  void run();
}

export function retry(id: string) {
  commit(jobs.map((j) => (j.id === id ? { ...j, status: "pending", error: undefined } : j)));
  void run(true);
}

export function discard(id: string) {
  commit(jobs.filter((j) => j.id !== id));
  syncedListeners.forEach((l) => l());
}

let running = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let backoff = 0;

async function run(force = false) {
  load();
  if (running) return;
  if (force) {
    clearTimeout(retryTimer);
    retryTimer = undefined;
  } else if (retryTimer) return; // waiting out a network error
  running = true;
  try {
    for (;;) {
      // In order; a failed job doesn't block the ones after it.
      const job = jobs.find((j) => j.status === "pending");
      if (!job) break;
      let res: Result;
      try {
        res = await runners[job.kind](job.payload);
      } catch {
        // Network / server unreachable (or signed out): keep it and try again later.
        backoff = Math.min(backoff ? backoff * 2 : 3000, 60_000);
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          void run();
        }, backoff);
        break;
      }
      backoff = 0;
      if (res.ok) commit(jobs.filter((j) => j.id !== job.id));
      else commit(jobs.map((j) => (j.id === job.id ? { ...j, status: "failed", error: res.error ?? "Couldn't save" } : j)));
      syncedListeners.forEach((l) => l());
    }
  } finally {
    running = false;
  }
}

/**
 * Mounted once in the admin layout: sends leftover jobs, retries when the
 * connection comes back, refreshes the page after each sync, and shows status.
 */
export function OutboxStatus() {
  const router = useRouter();
  const pathname = usePathname();
  const queue = useOutbox();

  useEffect(() => {
    void run(true);
    const online = () => void run(true);
    const refresh = () => router.refresh();
    window.addEventListener("online", online);
    syncedListeners.add(refresh);
    return () => {
      window.removeEventListener("online", online);
      syncedListeners.delete(refresh);
    };
  }, [router]);

  // Syncing is silent; only a change the server rejected needs the admin's attention.
  const failed = queue.filter((j) => j.status === "failed");
  if (!failed.length) return null;

  return (
    <div
      className="fixed inset-x-3 top-[calc(3.5rem+0.5rem)] z-40 mx-auto max-w-md space-y-2 lg:top-4 lg:right-6 lg:left-auto lg:mx-0 lg:w-80"
      role="status"
      aria-live="polite"
    >
      {failed.map((j) => (
        <div key={j.id} className="rounded-lg border border-red-500/40 bg-ink-850/95 p-3 text-xs shadow-2xl backdrop-blur-xl">
          <p className="flex items-start gap-2 text-red-300">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Couldn&apos;t save “{j.label}”: {j.error}
            </span>
          </p>
          <div className="mt-2 flex gap-2 pl-5.5">
            <button type="button" onClick={() => retry(j.id)} className="inline-flex items-center gap-1 text-gold-300 hover:underline">
              <RotateCw className="size-3" /> Retry
            </button>
            {j.editHref && j.editHref !== pathname && (
              <Link href={j.editHref} className="text-stone hover:text-ivory hover:underline">
                Edit
              </Link>
            )}
            <button type="button" onClick={() => discard(j.id)} className="ml-auto inline-flex items-center gap-1 text-mute hover:text-ivory">
              <X className="size-3" /> Discard
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Not saved" marker for list rows whose change the server rejected. */
export function SyncBadge({ failed, className }: { failed?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider",
        failed ? "bg-red-500/10 text-red-300" : "bg-gold-500/10 text-gold-300",
        className,
      )}
    >
      <AlertTriangle className="size-2.5" />
      {failed ? "Not saved" : "Syncing"}
    </span>
  );
}
