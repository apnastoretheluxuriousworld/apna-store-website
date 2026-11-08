/**
 * Create (or reset) an admin account. The password is only ever stored hashed.
 *
 *   npm run admin:create -- --username <name> --password '<at least 12 characters>' [--name "Store Admin"]
 *
 * Use a long random password (a password manager's generator). Don't reuse it
 * in test files or commit it anywhere.
 *
 * Running it again for the same username resets that admin's password.
 */
import { parseArgs } from "node:util";
import { need, fail } from "./_env.mts";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgSslFromEnv } from "../src/lib/db/ssl";
import { eq } from "drizzle-orm";
import * as s from "../src/lib/db/schema";
import { ADMIN_PASSWORD_MIN_LENGTH, hashPassword } from "../src/lib/auth/password";

const { values } = parseArgs({
  options: {
    username: { type: "string" },
    password: { type: "string" },
    name: { type: "string", default: "Store Admin" },
  },
});

const username = values.username?.trim().toLowerCase();
const password = values.password ?? "";
if (!username || !/^[a-z0-9._-]{3,32}$/.test(username)) fail("--username is required (3–32 letters, numbers, . _ -)");
if (password.length < ADMIN_PASSWORD_MIN_LENGTH) fail(`--password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters`);
if (/^\d+$/.test(password) || new Set(password).size < 6) fail("--password is too easy to guess: use a long random password");

const client = new Pool({ connectionString: need("DATABASE_URL_DIRECT"), ssl: pgSslFromEnv(), max: 1 });
const db = drizzle(client, { schema: s, casing: "snake_case" });

try {
  const passwordHash = await hashPassword(password);
  const [existing] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.username, username));

  if (existing) {
    await db
      .update(s.users)
      .set({ passwordHash, role: "admin", name: values.name! })
      .where(eq(s.users.id, existing.id));
    // Sign out any old sessions after a password reset.
    await db.delete(s.sessions).where(eq(s.sessions.userId, existing.id));
    console.log(`\n✓ Admin "${username}" updated — password reset, old sessions signed out.\n`);
  } else {
    await db.insert(s.users).values({ username, name: values.name!, passwordHash, role: "admin" });
    console.log(`\n✓ Admin "${username}" created.\n`);
  }
} catch (e) {
  fail(`could not create admin: ${e instanceof Error ? e.message : e}`);
} finally {
  await client.end();
}
