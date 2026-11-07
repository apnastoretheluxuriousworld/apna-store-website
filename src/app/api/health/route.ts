import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { storage } from "@/lib/storage";

/** GET /api/health — is the deployment wired to its database and bucket? */
export async function GET() {
  await connection(); // always run at request time

  const detail = process.env.NODE_ENV !== "production";
  const result: Record<string, unknown> = {};
  // Drizzle wraps driver errors ("Failed query: …"); the useful bit is the cause.
  const reason = (e: unknown): string =>
    e instanceof Error ? (e.cause instanceof Error ? e.cause.message : e.message) : String(e);

  try {
    const [{ count }] = await db()
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.categories);
    result.database = "ok";
    result.categories = count;
  } catch (e) {
    result.database = "error";
    if (detail) result.databaseError = reason(e);
  }

  try {
    await storage.ping();
    result.storage = "ok";
  } catch (e) {
    result.storage = "error";
    if (detail) result.storageError = reason(e);
  }

  const healthy = result.database === "ok" && result.storage === "ok";
  return Response.json({ status: healthy ? "ok" : "degraded", ...result }, { status: healthy ? 200 : 503 });
}
