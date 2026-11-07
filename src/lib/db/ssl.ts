/**
 * TLS settings for `pg`, shared by the app and the CLI scripts.
 *
 * "require" (default): encrypted, without CA verification — the same as libpq's
 * sslmode=require. Supabase supports it on both pooler ports.
 * "disable": plain TCP, for a Postgres on the same machine (VPS / docker).
 */
export type DbSslMode = "require" | "disable";

export function pgSsl(mode: DbSslMode = "require") {
  return mode === "disable" ? false : { rejectUnauthorized: false };
}

/** For scripts that read process.env directly. */
export function pgSslFromEnv() {
  return pgSsl(process.env.DB_SSL === "disable" ? "disable" : "require");
}
