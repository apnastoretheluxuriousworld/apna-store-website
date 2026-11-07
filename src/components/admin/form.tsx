"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-11 w-full rounded-lg border border-ink-600 bg-ink-900 px-3.5 text-sm text-ivory placeholder:text-mute transition-colors focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/15 focus:outline-none disabled:opacity-60 aria-invalid:border-red-500/60";

/** Dropdowns: same look as inputs, with an arrow that doesn't touch the border. */
export const selectClass = cn(inputClass, "select-chevron pr-6");

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[0.65rem] font-medium uppercase tracking-[0.18em] text-stone">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-mute">{hint}</p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  size = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const sm = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-300 disabled:opacity-50",
        sm ? "h-5 w-9" : "h-6 w-11",
        checked ? "border-gold-500/70 bg-gold-500/80" : "border-ink-600 bg-ink-700",
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-ivory shadow transition-transform duration-300",
          sm ? "size-3.5" : "size-4.5",
          checked ? (sm ? "translate-x-[1.1rem]" : "translate-x-[1.3rem]") : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/** Accessible confirm modal built on <dialog>. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Delete",
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-ink-600 bg-ink-850 p-6 text-ivory shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <h2 className="font-serif text-2xl">{title}</h2>
      <div className="mt-2 text-sm text-stone">{body}</div>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-lg px-4 text-sm text-stone hover:bg-ink-800 hover:text-ivory"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="h-10 rounded-lg bg-red-500/90 px-4 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
        >
          {pending ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

/**
 * Cancel + Save for admin forms. On mobile it's a full-width bar pinned on top of
 * the bottom nav (forms add pb-20 so nothing hides behind it); on desktop it sits
 * at the end of the form, right-aligned.
 */
export function FormActions({ cancelHref, saving, label }: { cancelHref: string; saving: boolean; label: string }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-ink-600/60 bg-ink-950/95 px-3 py-2.5 backdrop-blur-xl lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      <div className="mx-auto grid max-w-md grid-cols-[1fr_2fr] gap-2 lg:mx-0 lg:flex lg:max-w-none lg:justify-end">
        <Link
          href={cancelHref}
          className={buttonClass("outline", "md", "border-ink-600 px-4 text-stone hover:border-ink-600 hover:bg-ink-800 hover:text-ivory lg:min-w-28")}
        >
          Cancel
        </Link>
        <Button type="submit" disabled={saving} className="px-4 lg:min-w-40">
          {saving ? <Loader2 className="size-4 animate-spin" /> : label}
        </Button>
      </div>
    </div>
  );
}
