"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, inputClass, selectClass } from "@/components/admin/form";
import { Card } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { ORDER_STATUSES, STATUS_LABEL, formatDateTime, type OrderStatus } from "@/lib/orders";
import { saveOrderTracking, setOrderStatus } from "../actions";
import { cn } from "@/lib/utils";

type History = { id: string; status: OrderStatus; note: string | null; createdAt: string };
type Order = {
  id: string;
  status: OrderStatus;
  createdAt: string;
  history: History[];
  courierName: string;
  trackingNumber: string;
  trackingUrl: string;
};

/** Status update + shipment tracking. Both update the screen at once and sync in the background. */
export function OrderManage({ order }: { order: Order }) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [history, setHistory] = useState<History[]>(order.history);
  const [nextStatus, setNextStatus] = useState<OrderStatus>(order.status);
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState({ courierName: order.courierName, trackingNumber: order.trackingNumber, trackingUrl: order.trackingUrl });
  const [savedTracking, setSavedTracking] = useState(tracking);
  const [trackingError, setTrackingError] = useState<Record<string, string>>({});
  const [, start] = useTransition();

  const statusChanged = nextStatus !== status || note.trim() !== "";
  const trackingDirty = JSON.stringify(tracking) !== JSON.stringify(savedTracking);

  function updateStatus() {
    const prev = { status, history };
    const entry: History = { id: `tmp-${history.length}`, status: nextStatus, note: note.trim() || null, createdAt: new Date().toISOString() };
    setStatus(nextStatus);
    setHistory((h) => [...h, entry]);
    setNote("");
    start(async () => {
      const res = await setOrderStatus(order.id, { status: entry.status, note: entry.note ?? undefined });
      if (res.ok) {
        toast.success(`Order marked ${STATUS_LABEL[entry.status].toLowerCase()}`);
        router.refresh();
      } else {
        setStatus(prev.status);
        setHistory(prev.history);
        toast.error(res.error);
      }
    });
  }

  function saveTracking() {
    const prev = savedTracking;
    const next = {
      courierName: tracking.courierName.trim(),
      trackingNumber: tracking.trackingNumber.trim(),
      trackingUrl: tracking.trackingUrl.trim(),
    };
    setTrackingError({});
    setSavedTracking(next);
    setTracking(next);
    start(async () => {
      const res = await saveOrderTracking(order.id, next);
      if (res.ok) toast.success("Tracking details saved");
      else {
        setSavedTracking(prev);
        setTrackingError(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  const timeline = [...history].reverse();

  return (
    <aside className="space-y-4">
      <Card className="space-y-3">
        <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Update status</h2>
        <Field label="Status" htmlFor="o-status">
          <select id="o-status" className={selectClass} value={nextStatus} onChange={(e) => setNextStatus(e.target.value as OrderStatus)}>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
                {s === status ? " (current)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note for the customer (optional)" htmlFor="o-note" hint="Shown on their order tracker.">
          <input id="o-note" className={inputClass} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Dispatched from Mumbai" />
        </Field>
        <Button type="button" size="sm" disabled={!statusChanged} onClick={updateStatus}>
          Update
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Shipment tracking</h2>
        <Field label="Courier" htmlFor="o-courier">
          <input id="o-courier" className={inputClass} maxLength={80} value={tracking.courierName} onChange={(e) => setTracking((t) => ({ ...t, courierName: e.target.value }))} placeholder="Delhivery, Blue Dart…" />
        </Field>
        <Field label="Tracking number" htmlFor="o-awb">
          <input id="o-awb" className={inputClass} maxLength={80} value={tracking.trackingNumber} onChange={(e) => setTracking((t) => ({ ...t, trackingNumber: e.target.value }))} />
        </Field>
        <Field label="Tracking link" htmlFor="o-url" error={trackingError.trackingUrl}>
          <input
            id="o-url"
            type="url"
            className={inputClass}
            maxLength={500}
            value={tracking.trackingUrl}
            aria-invalid={!!trackingError.trackingUrl || undefined}
            onChange={(e) => setTracking((t) => ({ ...t, trackingUrl: e.target.value }))}
            placeholder="https://…"
          />
        </Field>
        <Button type="button" size="sm" disabled={!trackingDirty} onClick={saveTracking}>
          Save tracking
        </Button>
      </Card>

      <Card>
        <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">History</h2>
        <ol className="mt-3 space-y-3">
          {timeline.map((h, i) => (
            <li key={h.id} className="flex gap-3">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", i === 0 ? "bg-gold-400" : "bg-ink-600")} />
              <span>
                <span className="block text-sm text-ivory">{STATUS_LABEL[h.status]}</span>
                <span className="block text-xs text-mute">{formatDateTime(h.createdAt)}</span>
                {h.note && <span className="mt-0.5 block text-xs text-stone">{h.note}</span>}
              </span>
            </li>
          ))}
          {!history.some((h) => h.status === "placed") && (
            <li className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ink-600" />
              <span>
                <span className="block text-sm text-ivory">Order placed</span>
                <span className="block text-xs text-mute">{formatDateTime(order.createdAt)}</span>
              </span>
            </li>
          )}
        </ol>
      </Card>
    </aside>
  );
}
