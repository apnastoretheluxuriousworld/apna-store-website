import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "@/lib/db";
import { createSession, deleteSession, validateSession, type SessionUser } from "./core";

/**
 * Data Access Layer for auth. Every admin page AND every admin Server Action
 * must call requireAdmin() itself — layouts don't re-run on client
 * navigation, so a layout check alone is not a security boundary.
 */

const COOKIE = "apna_session";

/** Current user for this request (deduped per request), or null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  // Session validity depends on the current time and the DB, so it must run
  // at request time — not during the cookie-aware App Shell prerender that
  // Partial Prefetching performs (which forbids `new Date()`).
  await connection();
  return validateSession(db(), token);
});

export const requireAdmin = cache(async (): Promise<SessionUser> => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");
  return user;
});

/** Call from a Server Action after a successful login. */
export async function startSession(userId: string) {
  const { token, expiresAt } = await createSession(db(), userId);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Call from a Server Action to sign out. */
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await deleteSession(db(), token);
  jar.delete(COOKIE);
}

export const SESSION_COOKIE = COOKIE;
