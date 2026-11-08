import { Check, PackageCheck, PackageOpen, ReceiptText, Truck, X, BadgeCheck } from "lucide-react";
import { ORDER_FLOW, STATUS_HINT, STATUS_LABEL, STATUS_TONE, formatDateTime, type OrderStatus } from "@/lib/orders";
import { cn } from "@/lib/utils";

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.62rem] font-medium uppercase tracking-[0.16em] whitespace-nowrap",
        STATUS_TONE[status],
        className,
      )}
    >
      {status === "placed" ? "Placed" : STATUS_LABEL[status]}
    </span>
  );
}

const ICONS = { placed: ReceiptText, confirmed: BadgeCheck, packed: PackageOpen, shipped: Truck, delivered: PackageCheck, cancelled: X };

type HistoryEntry = { status: OrderStatus; note: string | null; createdAt: Date | string };

/**
 * Vertical step tracker. Each step shows when it happened (latest history entry
 * for that status). A cancelled order shows the steps it reached, then "Cancelled".
 */
export function OrderTracker({
  status,
  placedAt,
  history,
}: {
  status: OrderStatus;
  placedAt: Date | string;
  history: HistoryEntry[];
}) {
  const when = new Map<OrderStatus, HistoryEntry>();
  for (const h of history) when.set(h.status, h); // ascending → keeps the latest
  if (!when.has("placed")) when.set("placed", { status: "placed", note: null, createdAt: placedAt });

  const cancelled = status === "cancelled";
  // How far along the happy path the order got.
  const reached = cancelled
    ? Math.max(0, ...ORDER_FLOW.map((s, i) => (when.has(s) ? i : 0)))
    : ORDER_FLOW.indexOf(status as (typeof ORDER_FLOW)[number]);
  const steps: OrderStatus[] = cancelled ? [...ORDER_FLOW.slice(0, reached + 1), "cancelled"] : [...ORDER_FLOW];

  return (
    <ol className="relative" aria-label="Order progress">
      {steps.map((step, i) => {
        const done = cancelled ? true : i <= reached;
        const current = cancelled ? step === "cancelled" : i === reached;
        const entry = when.get(step);
        const Icon = ICONS[step];
        const last = i === steps.length - 1;
        return (
          <li key={step} className="relative flex gap-4 pb-6 last:pb-0" aria-current={current ? "step" : undefined}>
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-9 bottom-0 left-[1.0625rem] w-px",
                  done && (cancelled || i < reached) ? "bg-gold-500/60" : "bg-ink-600",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 grid size-9 shrink-0 place-items-center rounded-full border transition-colors",
                step === "cancelled"
                  ? "border-red-400/60 bg-red-500/10 text-red-300"
                  : current
                    ? "bg-gold border-transparent text-ink-950 shadow-[0_0_0_4px_rgba(212,175,55,0.15)]"
                    : done
                      ? "border-gold-500/60 bg-gold-500/10 text-gold-300"
                      : "border-ink-600 bg-ink-900 text-mute",
              )}
            >
              {done && !current && step !== "cancelled" ? <Check className="size-4" strokeWidth={2} /> : <Icon className="size-4" strokeWidth={1.6} />}
            </span>
            <div className="min-w-0 pt-1">
              <p className={cn("text-sm", done ? "text-ivory" : "text-mute", current && step !== "cancelled" && "text-gold-300")}>
                {STATUS_LABEL[step]}
              </p>
              {done && entry ? (
                <p className="mt-0.5 text-xs text-stone">{formatDateTime(entry.createdAt)}</p>
              ) : !done ? (
                <p className="mt-0.5 text-xs text-mute">Pending</p>
              ) : null}
              {current && <p className="mt-1 text-xs text-stone">{STATUS_HINT[step]}</p>}
              {entry?.note && done && <p className="mt-1 rounded-md bg-ink-900 px-2.5 py-1.5 text-xs text-stone">{entry.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
