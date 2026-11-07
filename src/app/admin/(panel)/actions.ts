"use server";

import { redirect } from "next/navigation";
import { endSession } from "@/lib/auth/session";

export async function signOut() {
  await endSession();
  redirect("/admin/login");
}
