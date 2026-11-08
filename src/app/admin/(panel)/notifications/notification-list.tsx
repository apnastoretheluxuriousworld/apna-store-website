"use client";

import { useEffect, useState } from "react";
import { BellOff, CheckCheck, KeyRound, MessagesSquare, ReceiptText, Star, Volume2, VolumeX, Wallet } from "lucide-react";
import { useNotifications } from "@/components/admin/notifications";
import { Card } from "@/components/admin/ui";
import type { AdminNotification, NotificationType } from "@/lib/data/notifications";
import { cn } from "@/lib/utils";

type Kind = NotificationType | "pin";

/** Each kind of notification gets its own color so the list scans at a glance. */
const KINDS: Record<Kind, { icon: typeof Star; badge: string; row: string; dot: string }> = {
  order: { icon: ReceiptText, badge: "bg-emerald-500/15 text-emerald-400", row: "bg-emerald-500/[0.06]", dot: "bg-emerald-400" },
  payment: { icon: Wallet, badge: "bg-sky-500/15 text-sky-400", row: "bg-sky-500/[0.06]", dot: "bg-sky-400" },
  review: { icon: Star, badge: "bg-gold-500/15 text-gold-400", row: "bg-gold-500/[0.06]", dot: "bg-gold-400" },
  feedback: { icon: MessagesSquare, badge: "bg-violet-500/15 text-violet-300", row: "bg-violet-500/[0.06]", dot: "bg-violet-300" },
  pin: { icon: KeyRound, badge: "bg-rose-500/15 text-rose-300", row: "bg-rose-500/[0.06]", dot: "bg-rose-300" },
};

// PIN reset requests are stored as customer messages (same chat thread), so tell them apart by title.
const kindOf = (item: AdminNotification): Kind =>
  item.type === "feedback" && item.title.startsWith("PIN reset request") ? "pin" : item.type;

const TZ = "Asia/Kolkata";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dateTime = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function ago(iso: string, now: number) {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} h ago`;
  return dateTime.format(new Date(iso));
}

function groupOf(iso: string, now: number) {
  const d = dayKey.format(new Date(iso));
  if (d === dayKey.format(new Date(now))) return "Today";
  if (d === dayKey.format(new Date(now - 86_400_000))) return "Yesterday";
  return "Earlier";
}

export function NotificationList() {
  const n = useNotifications();
  // Re-render each minute so "5 min ago" stays right.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!n || !n.loaded) {
    return (
      <div className="animate-pulse space-y-2" aria-busy="true" aria-label="Loading">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-18 rounded-xl bg-ink-850" />
        ))}
      </div>
    );
  }

  const groups = new Map<string, AdminNotification[]>();
  for (const item of n.items) {
    const g = groupOf(item.createdAt, now);
    groups.set(g, [...(groups.get(g) ?? []), item]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => n.setSound(!n.sound)}
            aria-pressed={n.sound}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-ink-600 px-3 text-xs text-stone hover:border-gold-500/40 hover:text-ivory"
          >
            {n.sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            Sound {n.sound ? "on" : "off"}
          </button>
          {n.unread > 0 && (
            <button
              type="button"
              onClick={n.markAllRead}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-gold-500/40 px-3 text-xs text-gold-300 hover:bg-gold-500/10"
            >
              <CheckCheck className="size-4" /> Mark all as read
            </button>
          )}
        </div>
      </div>

      {n.items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <BellOff className="size-8 text-mute" strokeWidth={1.25} />
          <p className="text-sm text-ivory">No notifications yet</p>
          <p className="max-w-xs text-xs text-mute">New orders, payment screenshots and customer reviews will show up here.</p>
        </Card>
      ) : (
        [...groups].map(([label, list]) => (
          <section key={label}>
            <h2 className="mb-2 px-1 text-[0.65rem] uppercase tracking-[0.2em] text-mute">{label}</h2>
            <ul className="overflow-hidden rounded-xl border border-ink-600/70 bg-ink-850 divide-y divide-ink-600/60">
              {list.map((item) => {
                const kind = KINDS[kindOf(item)];
                const Icon = kind.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => n.open(item)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ink-800",
                        !item.read && kind.row,
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full",
                          kind.badge,
                          item.read && "opacity-60",
                        )}
                      >
                        <Icon className="size-4" strokeWidth={1.5} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm", item.read ? "text-stone" : "font-medium text-ivory")}>{item.title}</span>
                        {item.body && <span className="mt-0.5 line-clamp-2 block text-xs text-mute">{item.body}</span>}
                        <span className="mt-1 block text-[0.7rem] text-mute">{ago(item.createdAt, now)}</span>
                      </span>
                      {!item.read && <span aria-label="Unread" className={cn("mt-2 size-2 shrink-0 rounded-full", kind.dot)} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
