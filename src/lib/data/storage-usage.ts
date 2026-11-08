import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { storage, type BucketUsage } from "@/lib/storage";

export const STORAGE_USAGE_TAG = "storage-usage";

/** Cloudflare R2's free storage each month (10 GB, counted as 10 × 1000³ bytes to stay on the safe side). */
export const R2_FREE_BYTES = 10 * 1000 ** 3;

export type StorageUsage = BucketUsage & { checkedAt: string };

/**
 * How much the media bucket holds. Listing the bucket costs R2 operations, so
 * it's cached on the server for an hour; the dashboard's Refresh button
 * clears it (updateTag) for an exact figure right after a cleanup.
 */
export async function getStorageUsage(): Promise<StorageUsage | null> {
  "use cache";
  cacheTag(STORAGE_USAGE_TAG);
  try {
    const usage = await storage.usage();
    cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
    return { ...usage, checkedAt: new Date().toISOString() };
  } catch (e) {
    console.error("[storage-usage]", e instanceof Error ? e.message : e);
    cacheLife("minutes"); // R2 not set up / unreachable — try again soon
    return null;
  }
}
