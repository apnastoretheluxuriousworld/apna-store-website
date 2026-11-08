import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

/** Already signed in → straight to the account (or ?next). Reads cookies, so render inside <Suspense>. */
export async function RedirectIfSignedIn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (user?.role !== "customer") return null; // the admin's session: let them sign in as a customer
  const next = (await searchParams).next;
  const n = typeof next === "string" ? next : "";
  redirect(n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/admin") && !n.startsWith("/account/") ? n : "/account");
}
