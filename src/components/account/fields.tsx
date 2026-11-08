"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Smartphone, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export const storeInputClass =
  "h-12 w-full rounded-lg border border-ink-600 bg-ink-900 text-[0.95rem] text-ivory placeholder:text-mute transition-colors focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/15 focus:outline-none aria-invalid:border-red-500/60";

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[0.65rem] uppercase tracking-[0.2em] text-stone">
      {children}
    </label>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-red-400">
      {message}
    </p>
  );
}

export function NameField({ defaultValue, error }: { defaultValue?: string; error?: string }) {
  return (
    <div>
      <Label htmlFor="name">Full name</Label>
      <span className="relative block">
        <UserRound className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gold-500/70" strokeWidth={1.5} />
        <input
          id="name"
          name="name"
          defaultValue={defaultValue}
          autoComplete="name"
          autoCapitalize="words"
          required
          maxLength={60}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "name-error" : undefined}
          placeholder="Your full name"
          className={cn(storeInputClass, "pr-4 pl-10")}
        />
      </span>
      <FieldError id="name-error" message={error} />
    </div>
  );
}

/** Digits only, max 10; drops a leading 0 / 91 / +91 from pasted or autofilled numbers. */
function toTenDigits(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  return d.slice(0, 10);
}

export function PhoneField({ defaultValue, error, autoFocus }: { defaultValue?: string; error?: string; autoFocus?: boolean }) {
  return (
    <div>
      <Label htmlFor="phone">Mobile number</Label>
      <span className="relative block">
        <Smartphone className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gold-500/70" strokeWidth={1.5} />
        <span className="pointer-events-none absolute top-1/2 left-10 -translate-y-1/2 text-[0.95rem] text-stone">+91</span>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          defaultValue={defaultValue ? toTenDigits(defaultValue) : undefined}
          autoComplete="tel-national"
          autoFocus={autoFocus}
          required
          // No maxLength: autofill/paste like "096763 41652" or "+91 98765 43210"
          // would be cut off mid-number. onInput trims it to the 10 digits instead.
          onInput={(e) => {
            const el = e.currentTarget;
            const clean = toTenDigits(el.value);
            if (clean !== el.value) el.value = clean;
          }}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "phone-error" : undefined}
          placeholder="9876543210"
          className={cn(storeInputClass, "pr-4 pl-[4.4rem] tracking-wide")}
        />
      </span>
      <FieldError id="phone-error" message={error} />
    </div>
  );
}

/** One 4-digit PIN input (a single field, so password managers and paste work). */
export function PinField({
  name,
  label,
  error,
  autoComplete,
  hint,
}: {
  name: string;
  label: string;
  error?: string;
  autoComplete: "current-password" | "new-password";
  hint?: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const id = `pin-${name}`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <span className="relative block">
        <LockKeyhole className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gold-500/70" strokeWidth={1.5} />
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          autoComplete={autoComplete}
          required
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          placeholder="••••"
          onInput={(e) => {
            const el = e.currentTarget;
            const digits = el.value.replace(/\D/g, "").slice(0, 4);
            if (digits !== el.value) el.value = digits;
          }}
          className={cn(storeInputClass, "pr-11 pl-10 text-lg tracking-[0.6em] placeholder:tracking-[0.4em]")}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide PIN" : "Show PIN"}
          className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded text-mute hover:text-gold-400"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </span>
      {error ? <FieldError id={`${id}-error`} message={error} /> : hint ? <p className="mt-1.5 text-xs text-mute">{hint}</p> : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  return (
    <p role="alert" aria-live="polite" className={cn("text-center text-xs text-red-400", message ? "min-h-5" : "min-h-0")}>
      {message}
    </p>
  );
}
