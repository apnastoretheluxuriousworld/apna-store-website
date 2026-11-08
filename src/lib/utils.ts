import type { FormEvent } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * onInput for number fields (prices, stock, sizes…): "012" → "12", "007.5" → "7.5"
 * ("0" and "0.5" stay). Runs before react-hook-form's onChange, so the form gets
 * the cleaned value. Not for phone numbers, PINs or PIN codes, where a leading 0 is real.
 */
export function trimLeadingZeros(e: FormEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  const next = el.value.replace(/^(-?)0+(?=\d)/, "$1");
  if (next !== el.value) el.value = next;
}
