import Link from "next/link";
import { Suspense } from "react";
import { FeedbackTabBadge } from "@/components/feedback/feedback-tab-badge";
import { cn } from "@/lib/utils";
export { AccountSkeleton } from "@/components/ui/skeleton";

const tabs = [
  { key: "orders", label: "My Orders", href: "/account" },
  { key: "feedback", label: "Feedback", href: "/account/feedback" },
  { key: "profile", label: "Profile & PIN", href: "/account/profile" },
] as const;

/** Static frame of the account pages (title + tabs); the signed-in part streams inside. */
export function AccountFrame({ active, children }: { active?: (typeof tabs)[number]["key"]; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-3xl px-4 pt-24 pb-16 sm:px-6 lg:pt-32">
      <p className="eyebrow">Apna Store</p>
      <h1 className="mt-2 font-serif text-4xl font-light text-ivory lg:text-5xl">
        My <em className="text-gold font-normal">Account</em>
      </h1>
      {active && (
        <nav aria-label="Account" className="mt-6 flex gap-1 overflow-x-auto border-b border-ink-600 scrollbar-none">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={t.key === active ? "page" : undefined}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 pb-3 text-xs whitespace-nowrap uppercase tracking-[0.18em] transition-colors",
                t.key === active ? "border-gold-500 text-gold-300" : "border-transparent text-mute hover:text-ivory",
              )}
            >
              {t.label}
              {t.key === "feedback" && (
                <Suspense fallback={null}>
                  <FeedbackTabBadge />
                </Suspense>
              )}
            </Link>
          ))}
        </nav>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}
