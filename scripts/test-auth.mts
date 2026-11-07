/**
 * npm run test:auth — password hashing, login, rate limiting and sessions
 * against an in-memory Postgres (no credentials needed).
 */
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as s from "../src/lib/db/schema";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import {
  attemptLogin,
  createSession,
  deleteSession,
  parseIdentifier,
  SESSION_TTL_MS,
  validateSession,
} from "../src/lib/auth/core";

const pg = new PGlite();
const db = drizzle(pg, { schema: s, casing: "snake_case" });
await migrate(db, { migrationsFolder: "./drizzle" });
const step = (m: string) => console.log(`  ✓ ${m}`);
console.log("\nAuth test (in-memory Postgres)");

// Passwords
const h1 = await hashPassword("121212");
const h2 = await hashPassword("121212");
assert.match(h1, /^scrypt\$17\$8\$1\$/);
assert.notEqual(h1, h2);
assert.equal(await verifyPassword("121212", h1), true);
assert.equal(await verifyPassword("121213", h1), false);
assert.equal(await verifyPassword("121212", "garbage"), false);
step("scrypt hashes are salted, verify right/wrong passwords");

// Identifiers
assert.deepEqual(parseIdentifier("ApnaStore"), { username: "apnastore" });
assert.deepEqual(parseIdentifier("+91 98765 43210"), { phone: "9876543210" });
assert.deepEqual(parseIdentifier("09876543210"), { phone: "9876543210" });
assert.equal(parseIdentifier("a b"), null);
step("username (case-insensitive) or Indian phone number accepted");

// Users
await assert.rejects(db.insert(s.users).values({ name: "x", passwordHash: h1 }));
const [admin] = await db
  .insert(s.users)
  .values({ name: "Store Admin", username: "apnastore", passwordHash: h1, role: "admin" })
  .returning();
step("a user must have a phone or a username");

// Login
const t0 = new Date("2026-11-07T10:00:00Z");
const ok = await attemptLogin(db, { identifier: "ApnaStore", password: "121212", ip: "1.1.1.1" }, t0);
assert.ok(ok.ok && ok.user.role === "admin");
const bad = await attemptLogin(db, { identifier: "apnastore", password: "nope", ip: "1.1.1.1" }, t0);
assert.deepEqual(bad, { ok: false, reason: "invalid" });
const ghost = await attemptLogin(db, { identifier: "nobody", password: "121212", ip: "1.1.1.1" }, t0);
assert.deepEqual(ghost, { ok: false, reason: "invalid" });
step("login: correct → ok, wrong password / unknown user → same generic error");

// Rate limiting: 5 failures per account per 15 min
for (let i = 0; i < 4; i++) {
  await attemptLogin(db, { identifier: "apnastore", password: "wrong", ip: "2.2.2.2" }, t0);
}
const locked = await attemptLogin(db, { identifier: "apnastore", password: "121212", ip: "3.3.3.3" }, t0);
assert.deepEqual(locked, { ok: false, reason: "locked" });
const later = new Date(t0.getTime() + 16 * 60 * 1000);
const unlocked = await attemptLogin(db, { identifier: "apnastore", password: "121212", ip: "3.3.3.3" }, later);
assert.ok(unlocked.ok);
step("locks after 5 wrong passwords, even for the right one; unlocks after 15 min");

// Sessions
const { token } = await createSession(db, admin.id, t0);
assert.equal(token.length, 43);
const [stored] = await db.select().from(s.sessions);
assert.notEqual(stored.id, token);
step("session token is random; only its SHA-256 is stored");

assert.equal((await validateSession(db, token, t0))?.username, "apnastore");
assert.equal(await validateSession(db, "forged-token", t0), null);
assert.equal(await validateSession(db, token, new Date(t0.getTime() + SESSION_TTL_MS + 1000)), null);
await deleteSession(db, token);
assert.equal(await validateSession(db, token, t0), null);
step("sessions: valid → user; forged / expired (30 days) / signed-out → rejected");

await pg.close();
console.log("\nAll auth tests passed ✓\n");
