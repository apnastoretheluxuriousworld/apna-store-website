/**
 * Framework-agnostic auth logic (sessions, login, rate limiting). Takes a
 * Drizzle instance so it runs in the app, in CLI scripts and in tests.
 *
 * Sessions: a random 32-byte token lives only in an httpOnly cookie; the DB
 * stores its SHA-256, so a leaked DB can't be replayed as live sessions.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as s from "@/lib/db/schema";
import { DUMMY_HASH, verifyPassword } from "./password";

type Db = PgDatabase<PgQueryResultHKT, typeof s>;

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type SessionUser = {
  id: string;
  name: string;
  role: "customer" | "admin";
  username: string | null;
  phone: string | null;
};

/* ───────────── Identifiers ───────────── */

/**
 * "98765 43210", "+91 9876543210", "09876543210" → { phone: "9876543210" }
 * anything else → { username: lower-cased }
 */
export function parseIdentifier(raw: string): { phone: string } | { username: string } | null {
  const v = raw.trim();
  if (!v) return null;
  const digits = v.replace(/[\s-]/g, "");
  const m = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(digits);
  if (m) return { phone: m[1] };
  if (/^[a-zA-Z0-9._-]{3,32}$/.test(v)) return { username: v.toLowerCase() };
  return null;
}

/* ───────────── Sessions ───────────── */

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(db: Db, userId: string, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(s.sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function validateSession(db: Db, token: string, now = new Date()): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const [row] = await db
    .select({
      id: s.users.id,
      name: s.users.name,
      role: s.users.role,
      username: s.users.username,
      phone: s.users.phone,
    })
    .from(s.sessions)
    .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
    .where(and(eq(s.sessions.id, hashToken(token)), gt(s.sessions.expiresAt, now)));
  return row ?? null;
}

export async function deleteSession(db: Db, token: string) {
  await db.delete(s.sessions).where(eq(s.sessions.id, hashToken(token)));
}

/** Housekeeping: drop expired sessions (called opportunistically on login). */
export async function purgeExpiredSessions(db: Db, now = new Date()) {
  await db.delete(s.sessions).where(lt(s.sessions.expiresAt, now));
}

/* ───────────── Rate limiting ───────────── */

export const LIMITS = {
  identifier: { max: 5, windowMs: 15 * 60 * 1000 }, // per account
  ip: { max: 20, windowMs: 15 * 60 * 1000 }, // per network address
};

async function isLocked(db: Db, key: string, max: number, now: Date) {
  const [row] = await db
    .select()
    .from(s.loginAttempts)
    .where(and(eq(s.loginAttempts.key, key), gt(s.loginAttempts.resetAt, now)));
  return !!row && row.failures >= max;
}

async function recordFailure(db: Db, key: string, windowMs: number, now: Date) {
  const resetAt = new Date(now.getTime() + windowMs);
  await db
    .insert(s.loginAttempts)
    .values({ key, failures: 1, resetAt })
    .onConflictDoUpdate({
      target: s.loginAttempts.key,
      // Expired window → start over; otherwise count up.
      // Raw sql`` params bypass column encoding, so pass ISO strings + cast
      // (postgres.js can't serialise Date objects there).
      set: {
        failures: sql`case when ${s.loginAttempts.resetAt} <= ${now.toISOString()}::timestamptz then 1 else ${s.loginAttempts.failures} + 1 end`,
        resetAt: sql`case when ${s.loginAttempts.resetAt} <= ${now.toISOString()}::timestamptz then ${resetAt.toISOString()}::timestamptz else ${s.loginAttempts.resetAt} end`,
      },
    });
}

/* ───────────── Login ───────────── */

export type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "invalid" | "locked" };

/**
 * Verifies credentials with rate limiting. Always spends the same hashing time
 * whether or not the account exists, and never says which part was wrong.
 */
export async function attemptLogin(
  db: Db,
  input: { identifier: string; password: string; ip?: string | null },
  now = new Date(),
): Promise<LoginResult> {
  const id = parseIdentifier(input.identifier);
  const idKey = `id:${id ? ("phone" in id ? id.phone : id.username) : input.identifier.trim().toLowerCase()}`;
  const ipKey = input.ip ? `ip:${input.ip}` : null;

  if (
    (await isLocked(db, idKey, LIMITS.identifier.max, now)) ||
    (ipKey && (await isLocked(db, ipKey, LIMITS.ip.max, now)))
  ) {
    return { ok: false, reason: "locked" };
  }

  const [user] = id
    ? await db
        .select()
        .from(s.users)
        .where("phone" in id ? eq(s.users.phone, id.phone) : eq(s.users.username, id.username))
    : [];

  const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    await recordFailure(db, idKey, LIMITS.identifier.windowMs, now);
    if (ipKey) await recordFailure(db, ipKey, LIMITS.ip.windowMs, now);
    return { ok: false, reason: "invalid" };
  }

  await db.delete(s.loginAttempts).where(eq(s.loginAttempts.key, idKey));
  return {
    ok: true,
    user: { id: user.id, name: user.name, role: user.role, username: user.username, phone: user.phone },
  };
}
