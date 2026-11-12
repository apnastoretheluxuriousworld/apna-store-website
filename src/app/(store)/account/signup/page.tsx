import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/account/auth-shell";
import { SignUpForm, SwitchAuthLink } from "@/components/account/auth-forms";
import { RedirectIfSignedIn } from "../redirect-if-signed-in";

/** Navigations here must show the page at once; `next dev` reports anything that blocks. */
export const instant = true;

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function SignUpPage({ searchParams }: PageProps<"/account/signup">) {
  return (
    <>
      <Suspense>
        <RedirectIfSignedIn searchParams={searchParams} />
      </Suspense>
      <AuthShell
        eyebrow="Join Apna Store"
        title="Create your"
        accent="account"
        subtitle="Track your orders and keep your details in one place."
        footer={
          <Suspense>
            Already have an account? <SwitchAuthLink to="/account/login">Sign in</SwitchAuthLink>
          </Suspense>
        }
      >
        <Suspense>
          <SignUpForm />
        </Suspense>
      </AuthShell>
    </>
  );
}
