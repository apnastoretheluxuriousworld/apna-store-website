import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { dbEnv } from "@/lib/env";
import * as schema from "./schema";
import { pgSsl } from "./ssl";

export type Database = NodePgDatabase<typeof schema>;

// Reuse one pool across hot reloads in dev and across requests in a warm
// serverless instance. The Drizzle wrapper is rebuilt when schema.ts changes:
// it caches column names per table, so a column added during `next dev` would
// otherwise have no name ("Cannot read properties of undefined (reading 'replace')").
const globalForDb = globalThis as unknown as { __apnaPool?: Pool; __apnaDb?: Database; __apnaSchema?: typeof schema };

/*
 * Driver: node-postgres (`pg`), NOT postgres.js. postgres.js pipelines several
 * queries on one connection when the pool is busy; Supabase's transaction
 * pooler (port 6543) answers only the first of them, so the rest hang forever
 * (or, per Supabase's docs, can even get another query's rows). Seen
 * 2026-11-08 as admin pages freezing mid-load. `pg` never sends a second query
 * on a connection before the first has finished, and its transactions work —
 * postgres.js's only off-switch (max_pipeline: 0) breaks `sql.begin()`.
 * Details: https://supabase.com/docs/guides/database/postgres-js
 */
function createPool(): Pool {
  const { DATABASE_URL, DB_POOL_MAX, DB_SSL } = dbEnv();
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: pgSsl(DB_SSL),
    max: DB_POOL_MAX,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
  });
  // An idle client can be dropped by the server/pooler at any time; without a
  // listener that error would crash the whole process. The pool replaces it.
  pool.on("error", (e) => console.warn("[db] idle connection dropped:", e.message));
  return pool;
}

/** Lazily-created Drizzle client. */
export function db(): Database {
  const g = globalForDb;
  if (!g.__apnaDb || g.__apnaSchema !== schema) {
    g.__apnaPool ??= createPool();
    g.__apnaDb = drizzle(g.__apnaPool, { schema, casing: "snake_case" });
    g.__apnaSchema = schema;
  }
  return g.__apnaDb;
}

export { schema };
