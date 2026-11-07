import "server-only";
import { cacheLife } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "@/lib/db";
import { createSession, deleteSession, validateSession, type SessionUser } from "./core";

/**
 * Data Access Layer for auth. Every admin page must call requireAdminView()
 * and every admin Server Action requireAdmin() itself — layouts don't re-run
 * on client navigation, so a layout check alone is not a security boundary.
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

/**
 * For Server Actions (and anything that mutates): always checks the session
 * against the DB at request time.
 */
export const requireAdmin = cache(async (): Promise<SessionUser> => {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");
  return user;
});

/**
 * For rendering admin pages and the panel layout. Same check as requireAdmin(),
 * but private-cached: the result is never stored on the server, only kept with
 * the rendered page in this browser's router cache (see the `admin` profile in
 * next.config.ts). That is what lets a revisited admin page show instantly.
 * The redirect is never cached. Signing out clears the browser cache.
 */
export async function requireAdminView(): Promise<SessionUser> {
  "use cache: private";
  cacheLife("admin");
  const token = (await cookies()).get(COOKIE)?.value;
  // No connection() here: it is not allowed in a cache scope, and inside one
  // the time read in validateSession() is allowed anyway.
  const user = token ? await validateSession(db(), token) : null;
  if (!user || user.role !== "admin") redirect("/admin/login");
  return user;
}

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
