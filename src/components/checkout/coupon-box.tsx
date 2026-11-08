"use client";

import { useRef, useState } from "react";
import { Loader2, TicketPercent, X } from "lucide-react";
import { applyCoupon, type AppliedCoupon } from "@/app/(store)/checkout/actions";
import type { CartItem } from "@/lib/validation/checkout";
import { cn } from "@/lib/utils";

/**
 * "Have a coupon?" in the order summary. The server checks the code against the
 * bag; the checkout then shows the discount (and checks it again on Place order).
 */
export function CouponBox({
  items,
  phone,
  applied,
  onApplied,
  error,
  onError,
  belowMinimum,
}: {
  items: CartItem[];
  phone: string;
  applied: AppliedCoupon | null;
  onApplied: (c: AppliedCoupon | null) => void;
  error: string | null;
  onError: (e: string | null) => void;
  /** The bag dropped below the coupon's minimum order since it was applied. */
  belowMinimum?: string | null;
}) {
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  // A plain flag, not useTransition: a transition would run the store's page-wide view transition on every apply.
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function apply() {
    if (pending) return;
    // Read the box itself: a tap right after typing/pasting can beat the state update.
    const typed = (input.current?.value ?? code).trim();
    if (!typed) {
      onError("Enter a coupon code");
      return;
    }
    setPending(true);
    try {
      const res = await applyCoupon({ code: typed, phone }, items);
      if (res.ok) {
        onApplied(res.data);
        onError(null);
        setCode("");
      } else onError(res.error);
    } catch {
      onError("Couldn't check the code. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (applied) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <TicketPercent className="size-4 shrink-0 text-emerald-300" strokeWidth={1.5} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm tracking-wider text-ivory" data-testid="applied-coupon">
              {applied.code}
            </span>
            <span className="block text-xs text-emerald-300">{applied.label} applied</span>
          </span>
          <button
            type="button"
            onClick={() => onApplied(null)}
            aria-label={`Remove coupon ${applied.code}`}
            className="grid size-8 shrink-0 place-items-center rounded-full text-stone hover:bg-ink-900 hover:text-ivory"
          >
            <X className="size-4" />
          </button>
        </div>
        {belowMinimum && <p className="mt-2 text-xs text-amber-200">{belowMinimum}</p>}
      </div>
    );
  }

  if (!open && !error) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 flex w-full items-center gap-2 rounded-xl border border-dashed border-ink-600 px-3.5 py-3 text-left text-sm text-stone hover:border-gold-500/50 hover:text-gold-300"
      >
        <TicketPercent className="size-4 text-gold-400" strokeWidth={1.5} /> Have a coupon code?
      </button>
    );
  }

  return (
    <div className="mt-4">
      <label htmlFor="coupon" className="mb-1.5 block text-[0.65rem] uppercase tracking-[0.2em] text-stone">
        Coupon code
      </label>
      <div className="flex gap-2">
        <input
          id="coupon"
          ref={input}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (error) onError(null);
          }}
          onKeyDown={(e) => {
            // Enter applies the code instead of placing the order.
            if (e.key === "Enter") {
              e.preventDefault();
              void apply();
            }
          }}
          autoFocus={open}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={30}
          placeholder="e.g. RIYA10"
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "coupon-error" : undefined}
          className={cn(
            "h-11 min-w-0 flex-1 rounded-lg border bg-ink-900 px-3.5 text-sm tracking-wider text-ivory uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-mute focus:border-gold-500/60 focus:outline-none",
            error ? "border-red-400/60" : "border-ink-600",
          )}
        />
        <button
          type="button"
          onClick={() => void apply()}
          disabled={pending}
          className="h-11 shrink-0 rounded-lg border border-gold-500/50 px-4 text-xs uppercase tracking-[0.18em] text-gold-300 hover:bg-gold-500/10 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
        </button>
      </div>
      {error && (
        <p id="coupon-error" role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
