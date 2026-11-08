"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { STORAGE_USAGE_TAG } from "@/lib/data/storage-usage";

/** Dashboard → Media storage → Refresh: re-count the bucket now instead of waiting for the hourly check. */
export async function refreshStorageUsage() {
  await requireAdmin();
  updateTag(STORAGE_USAGE_TAG);
  revalidatePath("/admin", "layout");
}
