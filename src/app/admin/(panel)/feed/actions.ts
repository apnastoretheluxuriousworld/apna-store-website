"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema as s } from "@/lib/db";
import { FEED_TAG } from "@/lib/data/feed";
import { deleteUnreferencedUploads } from "@/lib/storage/cleanup";
import { feedVideoInputSchema } from "@/lib/validation/feed";
import { zodFieldErrors, type ActionResult } from "@/lib/actions";

/** Refresh the homepage and the admin's client cache. */
function feedChanged() {
  updateTag(FEED_TAG);
  revalidatePath("/admin", "layout");
}

/**
 * Create or update a feed video. The id always comes from the client: an id we
 * don't know yet means "create with this id", so outbox retries never duplicate.
 */
export async function saveFeedVideo(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = feedVideoInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  const { id, caption, ...data } = parsed.data;
  const row = { ...data, title: caption };

  const d = db();
  try {
    const [before] = await d.select().from(s.reels).where(eq(s.reels.id, id));
    if (before) {
      await d.update(s.reels).set(row).where(eq(s.reels.id, id));
      const keep = new Set([row.videoUrl, row.posterUrl]);
      await deleteUnreferencedUploads([before.videoUrl, before.posterUrl].filter((u) => u && !keep.has(u)));
    } else {
      // New videos go to the front of the feed.
      await d.transaction(async (tx) => {
        await tx.update(s.reels).set({ sortOrder: sql`${s.reels.sortOrder} + 1` });
        await tx.insert(s.reels).values({ ...row, id, sortOrder: 0 }).onConflictDoNothing({ target: s.reels.id });
      });
    }
    feedChanged();
    return { ok: true, data: { id } };
  } catch (e) {
    console.error("[saveFeedVideo]", e);
    return { ok: false, error: "Couldn't save the video. Please try again." };
  }
}

const idSchema = z.uuid();

export async function deleteFeedVideo(id: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid video." };
  const [gone] = await db().delete(s.reels).where(eq(s.reels.id, parsed.data)).returning();
  if (gone) await deleteUnreferencedUploads([gone.videoUrl, gone.posterUrl]);
  feedChanged();
  return { ok: true };
}

export async function setFeedVideoActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success || typeof isActive !== "boolean") return { ok: false, error: "Invalid request." };
  await db().update(s.reels).set({ isActive }).where(eq(s.reels.id, id));
  feedChanged();
  return { ok: true };
}

export async function reorderFeed(ids: string[]): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.array(z.uuid()).max(500).safeParse(ids);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) return { ok: false, error: "Invalid order." };
  await db().transaction(async (tx) => {
    for (const [i, id] of parsed.data.entries()) {
      await tx.update(s.reels).set({ sortOrder: i }).where(eq(s.reels.id, id));
    }
  });
  feedChanged();
  return { ok: true };
}
