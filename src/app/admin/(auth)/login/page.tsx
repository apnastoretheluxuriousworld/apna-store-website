import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Emblem } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

/** Already signed in as admin → skip the form. Reads cookies, so it streams. */
async function RedirectIfSignedIn() {
  const user = await getCurrentUser();
  if (user?.role === "admin") redirect("/admin");
  return null;
}

export default function AdminLoginPage() {
  return (
    <main className="grain relative grid min-h-dvh place-items-center overflow-hidden bg-ink-950 px-5 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/2 size-[110vw] max-h-200 max-w-200 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.16),transparent_65%)]"
      />
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Emblem priority className="mx-auto h-14" />
          <p className="mt-6 font-serif text-3xl tracking-[0.12em] text-ivory uppercase">Apna Store</p>
          <p className="eyebrow mt-2">Admin Console</p>
        </div>

        <div className="rounded-2xl border border-gold-500/15 bg-ink-850/90 p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur sm:p-8">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <Link
          href="/"
          className="mx-auto mt-6 flex w-fit items-center gap-2 text-xs text-mute transition-colors hover:text-gold-400"
        >
          <ArrowLeft className="size-3.5" /> Back to store
        </Link>
      </div>
    </main>
  );
}
