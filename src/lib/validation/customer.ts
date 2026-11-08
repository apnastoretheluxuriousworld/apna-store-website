import { z } from "zod";

/**
 * Customer account rules, shared by the storefront forms and the server.
 * Phone: Indian mobile, stored as the bare 10 digits ("9876543210").
 * PIN: exactly 4 digits (the store's choice: easy to remember, no OTP).
 */

export const PIN_LENGTH = 4;

/** "+91 98765 43210", "098765-43210", "9876543210" → "9876543210", else null. */
export function normalizePhone(raw: string): string | null {
  const m = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(raw.replace(/[\s()-]/g, ""));
  return m ? m[1] : null;
}

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Enter your mobile number")
  .transform((v, ctx) => {
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number" });
      return z.NEVER;
    }
    return phone;
  });

export const pinSchema = z
  .string()
  .min(1, "Enter your 4-digit PIN")
  .regex(/^\d{4}$/, "Your PIN must be exactly 4 digits");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Enter your full name")
  .max(60, "Name is too long")
  .regex(/^[\p{L}\p{M} .'-]+$/u, "Use letters only")
  .transform((v) => v.replace(/\s+/g, " "));

export const signupSchema = z
  .object({ name: nameSchema, phone: phoneSchema, pin: pinSchema, confirmPin: z.string() })
  .refine((v) => v.pin === v.confirmPin, { path: ["confirmPin"], message: "PINs don't match" });

export const loginSchema = z.object({ phone: phoneSchema, pin: pinSchema });

export const changePinSchema = z
  .object({ current: pinSchema, pin: pinSchema, confirmPin: z.string() })
  .refine((v) => v.pin === v.confirmPin, { path: ["confirmPin"], message: "PINs don't match" })
  .refine((v) => v.pin !== v.current, { path: ["pin"], message: "Choose a PIN different from the current one" });

/** Pretty-print a stored 10-digit phone: "98765 43210". */
export function formatPhone(phone: string | null | undefined) {
  return phone && /^\d{10}$/.test(phone) ? `${phone.slice(0, 5)} ${phone.slice(5)}` : (phone ?? "");
}
