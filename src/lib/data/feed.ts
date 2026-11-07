import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema as s } from "@/lib/db";

/** Feed actions call updateTag(FEED_TAG) to refresh the homepage. */
export const FEED_TAG = "feed";

/** One vertical (9:16) video in "Our Feed". Stored in the `reels` table. */
export type FeedVideo = {
  id: string;
  caption: string;
  videoUrl: string;
  posterUrl: string | null;
};

const order = [asc(s.reels.sortOrder), desc(s.reels.createdAt)];

/** Visible feed videos for the homepage, in the admin's order. */
export async function getStoreFeed(): Promise<FeedVideo[]> {
  "use cache";
  cacheTag(FEED_TAG);
  cacheLife("hours");
  const rows = await db()
    .select()
    .from(s.reels)
    .where(eq(s.reels.isActive, true))
    .orderBy(...order);
  return rows.map((r) => ({ id: r.id, caption: r.title, videoUrl: r.videoUrl, posterUrl: r.posterUrl }));
}

/* ───────────── Admin (private-cached; call after requireAdminView()) ───────────── */

export async function listFeedForAdmin() {
  "use cache: private";
  cacheLife("admin");
  const rows = await db()
    .select()
    .from(s.reels)
    .orderBy(...order);
  return rows.map((r) => ({
    id: r.id,
    caption: r.title,
    videoUrl: r.videoUrl,
    posterUrl: r.posterUrl,
    isActive: r.isActive,
  }));
}

export type AdminFeedRow = Awaited<ReturnType<typeof listFeedForAdmin>>[number];

export async function getFeedVideoForEdit(id: string): Promise<AdminFeedRow | null> {
  "use cache: private";
  cacheLife("admin");
  const [r] = await db().select().from(s.reels).where(eq(s.reels.id, id));
  return r ? { id: r.id, caption: r.title, videoUrl: r.videoUrl, posterUrl: r.posterUrl, isActive: r.isActive } : null;
}
