import "server-only";
import { hit } from "@/lib/auth/core";
import { db } from "@/lib/db";

/**
 * Counts one hit for `key` (stored in login_attempts, e.g. "order:1.2.3.4")
 * and says whether it's still within `max` per window. One atomic upsert.
 * Fails open on a DB error: limits are a guard, not a reason to lose an order.
 */
export async function allowHit(key: string, max: number, windowMs: number): Promise<boolean> {
  try {
    return (await hit(db(), key, windowMs)) <= max;
  } catch (e) {
    console.warn("[rate-limit]", key, e instanceof Error ? e.message : e);
    return true;
  }
}
