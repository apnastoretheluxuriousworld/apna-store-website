"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { attemptLogin, purgeExpiredAttempts, purgeExpiredSessions } from "@/lib/auth/core";
import { HashBusy } from "@/lib/auth/password";
import { clientIp } from "@/lib/auth/request";
import { startSession } from "@/lib/auth/session";

export type LoginState = { error?: string; identifier?: string };

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter your username").max(64),
  password: z.string().min(1, "Enter your password").max(128),
  next: z.string().optional(),
});

/** Only allow redirects back into the admin area (no open redirects). */
function safeNext(next: string | undefined) {
  return next && next.startsWith("/admin") && !next.startsWith("//") && !next.startsWith("/\\") && next !== "/admin/login"
    ? next
    : "/admin";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  const identifier = String(formData.get("identifier") ?? "").slice(0, 64);
  if (!parsed.success) return { error: parsed.error.issues[0].message, identifier };

  let result: Awaited<ReturnType<typeof attemptLogin>>;
  try {
    // Admin scope: matches admin accounts by username only (never customers).
    result = await attemptLogin(db(), {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      ip: await clientIp(),
      scope: "admin",
    });
  } catch (e) {
    if (e instanceof HashBusy) return { identifier, error: "Too many sign-ins right now. Please try again in a moment." };
    // Never crash the login page on a DB hiccup — log the real cause, show a calm message.
    const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : e instanceof Error ? e.message : e;
    console.error("[login] database error:", cause);
    return { identifier, error: "We couldn't reach the database. Please try again in a moment." };
  }

  if (!result.ok) {
    return {
      identifier,
      error:
        result.reason === "locked"
          ? "Too many attempts. Please wait 15 minutes and try again."
          : "Incorrect username or password.",
    };
  }

  await startSession(result.user.id, result.user.role);
  await Promise.all([purgeExpiredSessions(db()), purgeExpiredAttempts(db())]).catch(() => {});
  redirect(safeNext(parsed.data.next));
}
