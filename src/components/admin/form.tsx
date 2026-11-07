"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-11 w-full rounded-lg border border-ink-600 bg-ink-900 px-3.5 text-sm text-ivory placeholder:text-mute transition-colors focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/15 focus:outline-none disabled:opacity-60 aria-invalid:border-red-500/60";

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
