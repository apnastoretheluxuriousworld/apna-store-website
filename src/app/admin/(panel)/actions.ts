"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { endSession } from "@/lib/auth/session";

export async function signOut() {
  await endSession();
  // Admin pages are kept in the browser's router cache (private cache); wipe it
  // so nothing from this session can be shown again in this tab.
  revalidatePath("/admin", "layout");
  redirect("/admin/login");
}
