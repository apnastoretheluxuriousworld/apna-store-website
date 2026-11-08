/**
 * Framework-agnostic auth logic (sessions, login, rate limiting). Takes a
 * Drizzle instance so it runs in the app, in CLI scripts and in tests.
 *
 * Sessions: a random 32-byte token lives only in an httpOnly cookie; the DB
 * stores its SHA-256, so a leaked DB can't be replayed as live sessions.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as s from "@/lib/db/schema";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./password";

type Db = PgDatabase<PgQueryResultHKT, typeof s>;

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (customers)
/** The admin account sees every customer's details, so its sign-in lasts a week. */
export const ADMIN_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  name: string;
  role: "customer" | "admin";
  username: string | null;
  phone: string | null;
  /** Account creation time ("member since"), so pages need no extra query. */
  createdAt: Date;
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

export async function createSession(db: Db, userId: string, now = new Date(), ttlMs = SESSION_TTL_MS) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + ttlMs);
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
      createdAt: s.users.createdAt,
    })
    .from(s.sessions)
    .innerJoin(s.users, eq(s.users.id, s.sessions.userId))
    .where(and(eq(s.sessions.id, hashToken(token)), gt(s.sessions.expiresAt, now), eq(s.users.isBlocked, false)));
  return row ?? null;
}

export async function deleteSession(db: Db, token: string) {
  await db.delete(s.sessions).where(eq(s.sessions.id, hashToken(token)));
}

/** Sign a user out everywhere (blocked, PIN reset by the store, PIN changed). */
export async function deleteUserSessions(db: Db, userId: string, keepToken?: string) {
  await db
    .delete(s.sessions)
    .where(
      keepToken
        ? and(eq(s.sessions.userId, userId), ne(s.sessions.id, hashToken(keepToken)))
        : eq(s.sessions.userId, userId),
    );
}

/** Housekeeping: drop expired sessions (called opportunistically on login). */
export async function purgeExpiredSessions(db: Db, now = new Date()) {
  await db.delete(s.sessions).where(lt(s.sessions.expiresAt, now));
}

/* ───────────── Rate limiting ───────────── */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const LIMITS = {
  /*
   * Customers (4-digit PIN = only 10,000 options).
   * Per account: stops guessing one person's PIN (15/day ≈ 2 years for all 10,000).
   */
  identifier: { max: 5, windowMs: 15 * MIN },
  identifierDaily: { max: 15, windowMs: DAY },
  /*
   * Per network address: stops trying a common PIN (1234, 0000…) across many
   * accounts, which the per-account limits can't see. Counts failed sign-ins
   * only (a correct PIN gives its attempt back), so customers sharing a mobile
   * carrier's IP (CGNAT) aren't held up by each other's successful sign-ins.
   */
  ip: { max: 20, windowMs: 15 * MIN },
  ipDaily: { max: 100, windowMs: DAY },
  /** Sign-up attempts per network address (also limits "is this number registered?" probing). */
  signup: { max: 15, windowMs: HOUR },
  /*
   * Admin: a long password, so the limits only need to stop bulk guessing.
   * Keyed per username AND network, so nobody can lock the real admin out by
   * failing on purpose from somewhere else.
   */
  admin: { max: 5, windowMs: 15 * MIN },
  adminIp: { max: 20, windowMs: 15 * MIN },
  /** Changing a PIN/password while signed in (per account). */
  changePassword: { max: 5, windowMs: 15 * MIN },
};

type Limit = { max: number; windowMs: number };

/**
 * Counts one attempt for `key` and returns the count in the current window, in
 * ONE atomic statement. Callers count BEFORE checking the password, so many
 * requests sent at once can't all get past the limit (a separate "check, then
 * record" lets every parallel request see the old count).
 */
export async function hit(db: Db, key: string, windowMs: number, now = new Date()): Promise<number> {
  const resetAt = new Date(now.getTime() + windowMs);
  const [row] = await db
    .insert(s.loginAttempts)
    .values({ key, failures: 1, resetAt })
    .onConflictDoUpdate({
      target: s.loginAttempts.key,
      // Expired window → start over; otherwise count up.
      // ISO strings + casts: raw sql`` params skip column encoding.
      set: {
        failures: sql`case when ${s.loginAttempts.resetAt} <= ${now.toISOString()}::timestamptz then 1 else ${s.loginAttempts.failures} + 1 end`,
        resetAt: sql`case when ${s.loginAttempts.resetAt} <= ${now.toISOString()}::timestamptz then ${resetAt.toISOString()}::timestamptz else ${s.loginAttempts.resetAt} end`,
      },
    })
    .returning({ n: s.loginAttempts.failures });
  return row.n;
}

/** Counts one attempt on every key; true when any of them is over its limit. */
async function overLimit(db: Db, checks: [key: string, limit: Limit][], now: Date) {
  const counts = await Promise.all(checks.map(([key, l]) => hit(db, key, l.windowMs, now)));
  return counts.some((n, i) => n > checks[i][1].max);
}

/** Gives back one counted attempt (a successful sign-in isn't a failure). */
async function refund(db: Db, keys: string[]) {
  if (!keys.length) return;
  await db
    .update(s.loginAttempts)
    .set({ failures: sql`greatest(${s.loginAttempts.failures} - 1, 0)` })
    .where(inArray(s.loginAttempts.key, keys));
}

/** Housekeeping: drop counters whose window has ended (called opportunistically on login). */
export async function purgeExpiredAttempts(db: Db, now = new Date()) {
  await db.delete(s.loginAttempts).where(lt(s.loginAttempts.resetAt, now));
}

/* ───────────── Login ───────────── */

export type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "invalid" | "locked" | "blocked" };

const toSessionUser = (u: typeof s.users.$inferSelect): SessionUser => ({
  id: u.id,
  name: u.name,
  role: u.role,
  username: u.username,
  phone: u.phone,
  createdAt: u.createdAt,
});

/**
 * Verifies credentials with rate limiting.
 *
 * `scope` decides who can sign in through which form: customers with their
 * phone + PIN, admins with their username + password. Each form only ever
 * matches its own kind of account, so the admin form can't be used to test
 * customer PINs (or the other way round).
 *
 * Always spends the same hashing time whether or not the account exists, and
 * never says which part was wrong.
 */
export async function attemptLogin(
  db: Db,
  input: { identifier: string; password: string; ip?: string | null; scope: "customer" | "admin" },
  now = new Date(),
): Promise<LoginResult> {
  const parsed = parseIdentifier(input.identifier);
  const id =
    input.scope === "customer"
      ? parsed && "phone" in parsed ? parsed.phone : null
      : parsed && "username" in parsed ? parsed.username : null;
  const raw = input.identifier.trim().toLowerCase().slice(0, 64);
  const ip = input.ip;

  // Keys counted before the password is checked (see hit()).
  const checks: [string, Limit][] =
    input.scope === "customer"
      ? [
          [`id:${id ?? raw}`, LIMITS.identifier],
          [`day:${id ?? raw}`, LIMITS.identifierDaily],
          ...(ip ? ([[`ip:${ip}`, LIMITS.ip], [`ipday:${ip}`, LIMITS.ipDaily]] as [string, Limit][]) : []),
        ]
      : [
          [`admin:${id ?? raw}@${ip ?? "unknown"}`, LIMITS.admin],
          ...(ip ? ([[`adminip:${ip}`, LIMITS.adminIp]] as [string, Limit][]) : []),
        ];
  if (await overLimit(db, checks, now)) return { ok: false, reason: "locked" };

  const role = input.scope;
  const [user] = id
    ? await db
        .select()
        .from(s.users)
        .where(and(role === "customer" ? eq(s.users.phone, id) : eq(s.users.username, id), eq(s.users.role, role)))
    : [];

  const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return { ok: false, reason: "invalid" };

  // Correct: this account's counters start over, and the network gets its attempt back.
  const keys = checks.map(([k]) => k);
  const perAccount = input.scope === "customer" ? keys.slice(0, 2) : keys.slice(0, 1);
  await db.delete(s.loginAttempts).where(inArray(s.loginAttempts.key, perAccount));
  await refund(db, keys.slice(perAccount.length));

  // Checked only after the password matched, so it can't be used to probe accounts.
  if (user.isBlocked) return { ok: false, reason: "blocked" };
  await db.update(s.users).set({ lastLoginAt: now }).where(eq(s.users.id, user.id));
  return { ok: true, user: toSessionUser(user) };
}

/* ───────────── Customer accounts ───────────── */

export type RegisterResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "phone_taken" | "locked" };

/**
 * Creates a customer account (name + 10-digit phone + PIN), already validated
 * by the caller. Every attempt from a network address is counted (before any
 * hashing), so the form can't be used to mass-create accounts or to check
 * which numbers are registered in bulk.
 */
export async function registerCustomer(
  db: Db,
  input: { name: string; phone: string; password: string; ip?: string | null },
  now = new Date(),
): Promise<RegisterResult> {
  if (input.ip && (await overLimit(db, [[`signup:${input.ip}`, LIMITS.signup]], now))) {
    return { ok: false, reason: "locked" };
  }

  // Cheap check first: no hashing for a number that's already taken.
  const [taken] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.phone, input.phone));
  if (taken) return { ok: false, reason: "phone_taken" };

  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(s.users)
    .values({ name: input.name, phone: input.phone, passwordHash, role: "customer", lastLoginAt: now })
    .onConflictDoNothing({ target: s.users.phone })
    .returning();
  if (!user) return { ok: false, reason: "phone_taken" };
  return { ok: true, user: toSessionUser(user) };
}

/** Change a password after checking the current one (rate limited like login). */
export async function changePassword(
  db: Db,
  input: { userId: string; current: string; next: string },
  now = new Date(),
): Promise<{ ok: true } | { ok: false; reason: "invalid" | "locked" }> {
  const key = `pw:${input.userId}`;
  if (await overLimit(db, [[key, LIMITS.changePassword]], now)) return { ok: false, reason: "locked" };
  const [user] = await db.select({ hash: s.users.passwordHash }).from(s.users).where(eq(s.users.id, input.userId));
  if (!user || !(await verifyPassword(input.current, user.hash))) return { ok: false, reason: "invalid" };
  await db.update(s.users).set({ passwordHash: await hashPassword(input.next) }).where(eq(s.users.id, input.userId));
  await db.delete(s.loginAttempts).where(eq(s.loginAttempts.key, key));
  return { ok: true };
}

/** Store-side PIN reset (customer forgot it): new hash, all sessions ended, lockout cleared. */
export async function resetPassword(db: Db, userId: string, next: string) {
  const [user] = await db
    .update(s.users)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(s.users.id, userId))
    .returning({ phone: s.users.phone });
  if (!user) return false;
  await deleteUserSessions(db, userId);
  if (user.phone) await db.delete(s.loginAttempts).where(inArray(s.loginAttempts.key, [`id:${user.phone}`, `day:${user.phone}`]));
  return true;
}
