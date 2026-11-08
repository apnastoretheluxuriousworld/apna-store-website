"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BadgeCheck, ExternalLink, ImageOff, X } from "lucide-react";
import { toast } from "sonner";
import { Field, inputClass } from "@/components/admin/form";
import { Card } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { formatDateTime, type PaymentStatus } from "@/lib/orders";
import { reviewPayment } from "../actions";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  total: number;
  cancelled: boolean;
  paymentStatus: PaymentStatus;
  proofUrl: string | null;
  reference: string | null;
  note: string | null;
  verifiedAt: string | null;
};

const REASONS = ["Amount doesn't match", "Payment not received in our account", "Screenshot is unclear", "Transaction ID doesn't match"];

/** UPI orders: check the screenshot, then approve or reject. Updates at once, syncs in the background. */
export function PaymentReview(p: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(p.paymentStatus);
  const [note, setNote] = useState(p.note);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [zoom, setZoom] = useState(false);
  const [, start] = useTransition();

  function send(input: { approve: true } | { approve: false; reason: string }) {
    const prev = { status, note };
    setStatus(input.approve ? "paid" : "failed");
    setNote(input.approve ? null : input.reason);
    setRejecting(false);
    setReason("");
    start(async () => {
      const res = await reviewPayment(p.id, input);
      if (res.ok) {
        toast.success(input.approve ? "Payment approved · order confirmed" : "Payment rejected · the customer will be asked for a new screenshot");
        router.refresh();
      } else {
        setStatus(prev.status);
        setNote(prev.note);
        toast.error(res.error);
      }
    });
  }

  const waiting = status === "pending";

  return (
    <Card className={cn("space-y-3", waiting && !p.cancelled && "border-amber-400/40")}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">UPI payment</h2>
        <span
          className={cn(
            "rounded-full border px-2 py-px text-[0.58rem] uppercase tracking-[0.14em]",
            status === "paid" ? "border-emerald-400/40 text-emerald-300" : status === "failed" ? "border-red-400/40 text-red-300" : "border-amber-400/50 text-amber-200",
          )}
        >
          {status === "paid" ? "Approved" : status === "failed" ? "Rejected" : "To verify"}
        </span>
      </div>

      <p className="text-xs text-stone">
        Check your bank / UPI app for <span className="font-semibold text-gold-300">{formatPrice(p.total)}</span>
        {p.reference && (
          <>
            {" "}
            with transaction ID <span className="font-mono text-ivory select-all">{p.reference}</span>
          </>
        )}
        .
      </p>

      {p.proofUrl ? (
        <button
          type="button"
          onClick={() => setZoom(true)}
          className="group relative block w-full overflow-hidden rounded-lg border border-ink-600 bg-ink-900"
          aria-label="View payment screenshot full size"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- customer upload, any size; shown as is */}
          <img src={p.proofUrl} alt="Payment screenshot" className="max-h-96 w-full object-contain" />
          <span className="absolute right-2 bottom-2 rounded-md bg-ink-950/80 px-2 py-1 text-[0.6rem] uppercase tracking-[0.14em] text-stone group-hover:text-gold-300">
            Tap to enlarge
          </span>
        </button>
      ) : (
        <p className="flex items-center gap-2 rounded-lg border border-dashed border-ink-600 p-4 text-xs text-mute">
          <ImageOff className="size-4" /> No screenshot uploaded.
        </p>
      )}

      {status === "paid" && p.verifiedAt && <p className="text-xs text-emerald-300/80">Approved {formatDateTime(p.verifiedAt)}</p>}
      {status === "failed" && note && <p className="rounded-md bg-red-500/10 px-2.5 py-1.5 text-xs text-red-200">Rejected: {note}</p>}

      {!p.cancelled &&
        (rejecting ? (
          <div className="space-y-2">
            <Field label="Reason (the customer sees this)" htmlFor="reject-reason">
              <input id="reject-reason" className={inputClass} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className="rounded-full border border-ink-600 px-2.5 py-1 text-[0.65rem] text-stone hover:border-gold-500/40 hover:text-gold-300"
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={reason.trim().length < 3}
                onClick={() => send({ approve: false, reason: reason.trim() })}
                className="bg-red-500/90 text-ivory shadow-none"
              >
                Reject payment
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {status !== "paid" && (
              <Button type="button" size="sm" onClick={() => send({ approve: true })}>
                <BadgeCheck className="size-4" /> Approve payment
              </Button>
            )}
            {status !== "failed" && (
              <Button type="button" size="sm" variant="outline" onClick={() => setRejecting(true)} className="border-red-400/40 text-red-300 hover:border-red-400 hover:bg-red-500/10">
                Reject
              </Button>
            )}
          </div>
        ))}

      {zoom && p.proofUrl && (
        <div role="dialog" aria-modal="true" aria-label="Payment screenshot" className="fixed inset-0 z-[100] flex flex-col bg-ink-950/95 backdrop-blur" onClick={() => setZoom(false)}>
          <div className="flex justify-end gap-2 p-3">
            <a
              href={p.proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="grid size-10 place-items-center rounded-full bg-ink-800 text-stone hover:text-gold-300"
              aria-label="Open in a new tab"
            >
              <ExternalLink className="size-4" />
            </a>
            <button type="button" className="grid size-10 place-items-center rounded-full bg-ink-800 text-stone hover:text-gold-300" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.proofUrl} alt="Payment screenshot" className="min-h-0 flex-1 object-contain p-3 pt-0" />
        </div>
      )}
    </Card>
  );
}
