import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { storage } from "@/lib/storage";

/**
 * GET /api/health
 * - Anyone: { status: "ok" } with no database or storage work, so the URL
 *   can't be used to load the database or run up storage operations.
 * - With header `x-health-token: <HEALTH_TOKEN>` (or in development): also
 *   checks the database and the bucket.
 */
export async function GET(request: Request) {
  await connection(); // always run at request time

  const dev = process.env.NODE_ENV !== "production";
  if (!dev && !hasToken(request.headers.get("x-health-token"))) return Response.json({ status: "ok" });

  const result: Record<string, unknown> = {};
  // Drizzle wraps driver errors ("Failed query: …"); the useful bit is the cause.
  const reason = (e: unknown): string =>
    e instanceof Error ? (e.cause instanceof Error ? e.cause.message : e.message) : String(e);

  try {
    await db().select({ one: sql<number>`1` }).from(schema.categories).limit(1);
    result.database = "ok";
  } catch (e) {
    result.database = "error";
    if (dev) result.databaseError = reason(e);
  }

  try {
    await storage.ping();
    result.storage = "ok";
  } catch (e) {
    result.storage = "error";
    if (dev) result.storageError = reason(e);
  }

  const healthy = result.database === "ok" && result.storage === "ok";
  return Response.json({ status: healthy ? "ok" : "degraded", ...result }, { status: healthy ? 200 : 503 });
}

function hasToken(given: string | null) {
  const expected = process.env.HEALTH_TOKEN;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
