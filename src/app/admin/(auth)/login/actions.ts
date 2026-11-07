"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { attemptLogin, purgeExpiredSessions } from "@/lib/auth/core";
import { startSession } from "@/lib/auth/session";

export type LoginState = { error?: string; identifier?: string };

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter your username or phone number").max(64),
  password: z.string().min(1, "Enter your password").max(128),
  next: z.string().optional(),
});

/** Only allow redirects back into the admin area (no open redirects). */
function safeNext(next: string | undefined) {
  return next && next.startsWith("/admin") && !next.startsWith("//") && next !== "/admin/login"
    ? next
    : "/admin";
}

async function clientIp() {
  const h = await headers();
  return (
    h.get("x-nf-client-connection-ip") ?? // Netlify
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null
  );
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  const identifier = String(formData.get("identifier") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, identifier };

  let result: Awaited<ReturnType<typeof attemptLogin>>;
  try {
    result = await attemptLogin(db(), {
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      ip: await clientIp(),
    });
  } catch (e) {
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
          : "Incorrect username/phone or password.",
    };
  }
  if (result.user.role !== "admin") {
    return { identifier, error: "This account doesn't have admin access." };
  }

  await startSession(result.user.id);
  await purgeExpiredSessions(db()).catch(() => {});
  redirect(safeNext(parsed.data.next));
}
