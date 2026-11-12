import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountFrame, AccountSkeleton } from "@/components/account/account-frame";
import { ChangePinForm, NameForm } from "@/components/account/profile-forms";
import { CustomerSignOutButton } from "@/components/account/sign-out-button";
import { cacheLife } from "next/cache";
import { requireCustomerView } from "@/lib/auth/session";
import { formatPhone } from "@/lib/validation/customer";

/** Navigations here must show the page at once; `next dev` reports anything that blocks. */
export const instant = true;

export const metadata: Metadata = { title: "Profile", robots: { index: false } };

export default function ProfilePage() {
  return (
    <AccountFrame active="profile">
      <Suspense fallback={<AccountSkeleton />}>
        <Profile />
      </Suspense>
    </AccountFrame>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink-600/80 bg-ink-850 p-4 sm:p-5">
      <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory/80">{title}</h2>
      {description && <p className="mt-1 text-xs text-stone">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

async function Profile() {
  "use cache: private";
  cacheLife("account");
  const user = await requireCustomerView("/account/profile");

  return (
    <div className="space-y-4">
      <Section title="Your details">
        <NameForm name={user.name} />
        <div className="mt-4">
          <p className="mb-1.5 text-[0.65rem] uppercase tracking-[0.2em] text-stone">Mobile number</p>
          <p className="flex h-12 items-center rounded-lg border border-ink-600/60 bg-ink-900/60 px-4 text-[0.95rem] text-stone">
            +91 {formatPhone(user.phone)}
          </p>
          <p className="mt-1.5 text-xs text-mute">This is how you sign in. To change it, please contact the store.</p>
        </div>
      </Section>
      <Section title="Change PIN" description="Changing your PIN signs you out on every other device.">
        <ChangePinForm />
      </Section>
      <div className="flex justify-end">
        <CustomerSignOutButton />
      </div>
    </div>
  );
}
