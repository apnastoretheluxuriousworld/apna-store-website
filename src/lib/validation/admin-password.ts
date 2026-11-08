/**
 * Admin password rules, shared by Admin → Settings (browser + server) and
 * scripts/create-admin.mts. The admin account sees every customer's name,
 * phone and address, so it needs a real password (customers use a 4-digit PIN).
 */
import { z } from "zod";

export const ADMIN_PASSWORD_MIN_LENGTH = 12;
export const ADMIN_PASSWORD_MAX_LENGTH = 128;

/** Why a new admin password isn't allowed, or null when it's fine. */
export function adminPasswordProblem(pw: string): string | null {
  if (pw.length < ADMIN_PASSWORD_MIN_LENGTH) return `Use at least ${ADMIN_PASSWORD_MIN_LENGTH} characters`;
  if (pw.length > ADMIN_PASSWORD_MAX_LENGTH) return `At most ${ADMIN_PASSWORD_MAX_LENGTH} characters`;
  if (/^\d+$/.test(pw)) return "Don't use only numbers";
  if (new Set(pw.toLowerCase()).size < 6) return "Too easy to guess: use more different characters";
  return null;
}

export const changeAdminPasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password").max(ADMIN_PASSWORD_MAX_LENGTH),
    next: z.string().superRefine((v, ctx) => {
      const problem = adminPasswordProblem(v);
      if (problem) ctx.addIssue({ code: "custom", message: problem });
    }),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
  .refine((v) => v.next !== v.current, { path: ["next"], message: "Choose a password different from the current one" });

export type ChangeAdminPasswordValues = z.input<typeof changeAdminPasswordSchema>;
