"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { storage, UploadRejected, uploadFolders } from "@/lib/storage";
import { deleteUnreferencedUploads } from "@/lib/storage/cleanup";
import type { ActionResult } from "@/lib/actions";

const schema = z.object({
  folder: z.enum(uploadFolders),
  contentType: z.string().max(100),
  size: z.number().int().positive(),
});

/** Presigned direct-to-bucket upload URL for the admin's browser. */
export async function getUploadUrl(
  input: unknown,
): Promise<ActionResult<{ uploadUrl: string; publicUrl: string; key: string }>> {
  await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid upload request." };

  try {
    const res = await storage.createUploadUrl(parsed.data);
    return { ok: true, data: res };
  } catch (e) {
    if (e instanceof UploadRejected) return { ok: false, error: e.message };
    if (e instanceof Error && e.message.includes("storage environment")) {
      return { ok: false, error: "Media storage isn't connected yet — add the R2 keys to .env (SETUP.md §2)." };
    }
    console.error("[getUploadUrl]", e);
    return { ok: false, error: "Couldn't prepare the upload. Please try again." };
  }
}

/**
 * Delete a file the admin uploaded but then replaced/removed before saving.
 * Only touches files in our bucket that nothing in the database references,
 * so a saved image is never removed here — that happens when the form is saved.
 */
export async function discardUpload(url: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.url().max(2000).safeParse(url);
  if (!parsed.success) return { ok: false, error: "Invalid file." };
  await deleteUnreferencedUploads([parsed.data]);
  return { ok: true };
}
