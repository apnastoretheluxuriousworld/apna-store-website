import Link from "next/link";
import { Emblem } from "@/components/brand/logo";
import { site, type NavCategory } from "@/lib/site";

const policies = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Refunds", href: "/refund-policy" },
  { label: "Shipping", href: "/shipping-policy" },
];

/**
 * Mobile: compact strip (brand row + policies) — collections already live in
 * the bottom bar's Menu/Shop. Desktop (lg+): unchanged full footer.
 */
export function SiteFooter({ categories }: { categories: NavCategory[] }) {
  return (
    <footer className="border-t border-ink-600/60 bg-ink-950">
      <div className="mx-auto max-w-site px-5 py-6 lg:px-12 lg:py-12">
        <div className="flex flex-col items-center gap-8 text-center lg:flex-row lg:justify-between lg:text-left">
          <div className="flex items-center gap-3 lg:gap-4">
            <Emblem className="h-7 lg:h-10" />
            <div className="text-left">
              <p className="font-serif text-base leading-tight tracking-[0.15em] text-ivory uppercase lg:text-xl">
                {site.name}
              </p>
              <p className="eyebrow mt-0.5 !text-[0.5rem] lg:mt-1 lg:!text-[0.6rem]">{site.tagline}</p>
            </div>
          </div>

          <nav
            aria-label="Footer collections"
            className="hidden flex-wrap justify-center gap-x-6 gap-y-2 lg:flex"
          >
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/shop/${c.slug}`}
                className="text-[0.7rem] uppercase tracking-[0.22em] text-stone transition-colors hover:text-gold-400"
              >
                {c.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hairline my-4 opacity-30 lg:my-8" />

        <div className="flex flex-col items-center gap-2 text-[0.6rem] text-mute lg:flex-row lg:justify-between lg:gap-4 lg:text-[0.7rem]">
          <nav aria-label="Policies" className="flex gap-4 lg:order-2 lg:gap-5">
            {policies.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="uppercase tracking-[0.15em] transition-colors hover:text-gold-400 lg:tracking-[0.18em]"
              >
                {p.label}
              </Link>
            ))}
          </nav>
          <p className="lg:order-1">© {site.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
