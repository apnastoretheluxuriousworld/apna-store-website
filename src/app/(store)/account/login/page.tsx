import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/account/auth-shell";
import { SignInForm, SwitchAuthLink } from "@/components/account/auth-forms";
import { RedirectIfSignedIn } from "../redirect-if-signed-in";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage({ searchParams }: PageProps<"/account/login">) {
  return (
    <>
      <Suspense>
        <RedirectIfSignedIn searchParams={searchParams} />
      </Suspense>
      <AuthShell
        eyebrow="My Account"
        title="Welcome"
        accent="back"
        subtitle="Sign in with your mobile number and PIN."
        footer={
          <Suspense>
            New to Apna Store? <SwitchAuthLink to="/account/signup">Create an account</SwitchAuthLink>
          </Suspense>
        }
      >
        <Suspense>
          <SignInForm />
        </Suspense>
      </AuthShell>
    </>
  );
}
