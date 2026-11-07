import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { dbEnv } from "@/lib/env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

// Reuse one pool across hot reloads in dev and across requests in a warm
// serverless instance.
const globalForDb = globalThis as unknown as { __apnaDb?: Database };

// NOTE: keep postgres.js on v3.x. v4.1 intermittently left queries half-sent
// ("ClientRead") through Supabase's transaction pooler inside Next.js
// renders, hanging pages (reproduced + fixed by pinning v3.4.7, 2026-11-07).
function create(): Database {
  const { DATABASE_URL, DB_POOL_MAX } = dbEnv();
  const client = postgres(DATABASE_URL, {
    // Required for Supabase's transaction pooler (PgBouncer); harmless elsewhere.
    prepare: false,
    max: DB_POOL_MAX,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client, { schema, casing: "snake_case" });
}

/** Lazily-created Drizzle client. */
export function db(): Database {
  return (globalForDb.__apnaDb ??= create());
}

export { schema };
