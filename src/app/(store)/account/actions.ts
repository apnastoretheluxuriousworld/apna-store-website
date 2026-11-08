"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import {
  attemptLogin,
  changePassword,
  deleteUserSessions,
  purgeExpiredAttempts,
  purgeExpiredSessions,
  registerCustomer,
} from "@/lib/auth/core";
import { HashBusy } from "@/lib/auth/password";
import { clientIp } from "@/lib/auth/request";
import { currentSessionToken, endSession, getCurrentUser, startSession } from "@/lib/auth/session";
import { zodFieldErrors } from "@/lib/actions";
import { changePinSchema, loginSchema, nameSchema, signupSchema } from "@/lib/validation/customer";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Typed values echoed back so the form keeps them (never the PIN). */
  values?: Record<string, string>;
  ok?: boolean;
};

/** Only same-site paths, never back to the sign-in pages or the admin. */
function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") &&
    !n.startsWith("//") &&
    !n.startsWith("/\\") &&
    !n.startsWith("/admin") &&
    !n.startsWith("/account/login") &&
    !n.startsWith("/account/signup")
    ? n
    : "/account";
}

const DB_DOWN = "We couldn't reach the store right now. Please try again in a moment.";
const BUSY = "Lots of people are signing in right now. Please try again in a moment.";

/** Account pages are cached in this browser; wipe them whenever who/what they show changes. */
const accountChanged = () => revalidatePath("/account", "layout");

function logDbError(where: string, e: unknown) {
  const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : e instanceof Error ? e.message : e;
  console.error(`[account] ${where}:`, cause);
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const values = { name: raw.name ?? "", phone: raw.phone ?? "" };
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { values, fieldErrors: zodFieldErrors(parsed.error) };

  let result: Awaited<ReturnType<typeof registerCustomer>>;
  try {
    result = await registerCustomer(db(), {
      name: parsed.data.name,
      phone: parsed.data.phone,
      password: parsed.data.pin,
      ip: await clientIp(),
    });
  } catch (e) {
    if (e instanceof HashBusy) return { values, error: BUSY };
    logDbError("sign up", e);
    return { values, error: DB_DOWN };
  }

  if (!result.ok) {
    return result.reason === "phone_taken"
      ? { values, fieldErrors: { phone: "An account with this mobile number already exists. Sign in instead." } }
      : { values, error: "Too many sign-up attempts from this network. Please try again in an hour." };
  }

  await startSession(result.user.id, "customer");
  accountChanged();
  redirect(safeNext(formData.get("next")));
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const values = { phone: raw.phone ?? "" };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { values, fieldErrors: zodFieldErrors(parsed.error) };

  let result: Awaited<ReturnType<typeof attemptLogin>>;
  try {
    // Customer scope: matches customer accounts by phone only (never the admin).
    result = await attemptLogin(db(), { identifier: parsed.data.phone, password: parsed.data.pin, ip: await clientIp(), scope: "customer" });
  } catch (e) {
    if (e instanceof HashBusy) return { values, error: BUSY };
    logDbError("sign in", e);
    return { values, error: DB_DOWN };
  }

  if (!result.ok) {
    return {
      values,
      error:
        result.reason === "locked"
          ? "Too many attempts. Please wait 15 minutes and try again."
          : result.reason === "blocked"
            ? "This account has been suspended. Please contact the store."
            : "Incorrect mobile number or PIN.",
    };
  }

  await startSession(result.user.id, "customer");
  await Promise.all([purgeExpiredSessions(db()), purgeExpiredAttempts(db())]).catch(() => {});
  accountChanged();
  redirect(safeNext(formData.get("next")));
}

export async function signOutCustomer() {
  await endSession();
  accountChanged();
  redirect("/");
}

export async function updateName(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  // Customers only: the admin account must never get a 4-digit PIN through this form.
  if (user?.role !== "customer") redirect("/account/login?next=/account/profile");
  const raw = String(formData.get("name") ?? "");
  const parsed = nameSchema.safeParse(raw);
  if (!parsed.success) return { values: { name: raw }, fieldErrors: { name: parsed.error.issues[0].message } };
  try {
    await db().update(s.users).set({ name: parsed.data }).where(eq(s.users.id, user.id));
  } catch (e) {
    logDbError("update name", e);
    return { values: { name: raw }, error: DB_DOWN };
  }
  accountChanged();
  return { ok: true, values: { name: parsed.data } };
}

export async function changePin(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  // Customers only: the admin account must never get a 4-digit PIN through this form.
  if (user?.role !== "customer") redirect("/account/login?next=/account/profile");
  const parsed = changePinSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: zodFieldErrors(parsed.error) };

  try {
    const result = await changePassword(db(), { userId: user.id, current: parsed.data.current, next: parsed.data.pin });
    if (!result.ok) {
      return result.reason === "locked"
        ? { error: "Too many attempts. Please wait 15 minutes and try again." }
        : { fieldErrors: { current: "That's not your current PIN." } };
    }
    // A new PIN signs out every other device, but keeps this one signed in.
    await deleteUserSessions(db(), user.id, await currentSessionToken());
  } catch (e) {
    if (e instanceof HashBusy) return { error: BUSY };
    logDbError("change PIN", e);
    return { error: DB_DOWN };
  }
  accountChanged();
  return { ok: true };
}
