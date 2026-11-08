import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import { Emblem } from "@/components/brand/logo";
import { AdminHold } from "./admin-hold";
import {
  InstagramIcon,
  WhatsappIcon,
  YoutubeIcon,
} from "@/components/brand/social-icons";
import type { StoreInfo } from "@/lib/data/settings";
import { site, type NavCategory } from "@/lib/site";

const links = [
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
  { label: "Feedback", href: "/account/feedback" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

/**
 * Compact footer: brand + socials, one line each for phones and address, then
 * info/policy links and ©. Contact details and socials come from Admin → Settings;
 * anything left blank is hidden. Collections show on desktop only — on phones
 * they live in the bottom bar's Menu/Shop.
 */
export function SiteFooter({
  categories,
  info,
}: {
  categories: NavCategory[];
  info: StoreInfo;
}) {
  const socials = [
    info.instagram && {
      label: `Instagram ${info.instagram.handle}`,
      href: info.instagram.url,
      Icon: InstagramIcon,
    },
    info.youtubeUrl && {
      label: "YouTube",
      href: info.youtubeUrl,
      Icon: YoutubeIcon,
    },
    info.whatsappUrl && {
      label: "WhatsApp",
      href: info.whatsappUrl,
      Icon: WhatsappIcon,
    },
  ].filter((x) => !!x);
  const address = info.addressLines.slice(0, 2).join(", ");

  return (
    <footer className="border-t border-ink-600/60 bg-ink-950">
      <div className="mx-auto max-w-site px-5 py-6 lg:px-12 lg:py-10">
        {/* Brand · collections (desktop) · socials */}
        <div className="flex flex-col items-center gap-4 lg:flex-row lg:justify-between lg:gap-8">
          <div className="flex items-center gap-3">
            <AdminHold>
              <Emblem className="h-7 lg:h-9" />
            </AdminHold>
            <div>
              <p className="font-serif text-base leading-tight tracking-[0.15em] text-ivory uppercase lg:text-lg">
                {site.name}
              </p>
              <p className="eyebrow mt-0.5 !text-[0.5rem] lg:!text-[0.55rem]">
                {site.tagline}
              </p>
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

          {socials.length > 0 && (
            <div className="flex gap-2.5">
              {socials.map(({ label, href, Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="grid size-9 place-items-center rounded-full border border-gold-500/40 text-gold-400 transition-all duration-300 hover:border-gold-300 hover:text-gold-300 hover:shadow-[0_0_20px_-6px_rgba(212,175,55,0.6)]"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Phones · address */}
        {(info.phones.length > 0 || address) && (
          <div className="mt-4 flex flex-col items-center gap-1.5 text-center text-xs text-stone lg:mt-6 lg:flex-row lg:justify-center lg:gap-6">
            {info.phones.length > 0 && (
              <p className="inline-flex flex-wrap items-center justify-center gap-x-2 tabular-nums">
                <Phone
                  className="size-3.5 text-gold-500"
                  strokeWidth={1.5}
                  aria-hidden
                />
                {info.phones.map((p, i) => (
                  <span key={p.tel} className="inline-flex items-center gap-2">
                    {i > 0 && <span className="text-mute">·</span>}
                    <a
                      href={`tel:${p.tel}`}
                      className="transition-colors hover:text-gold-300"
                    >
                      {p.label}
                    </a>
                  </span>
                ))}
              </p>
            )}
            {address && (
              <a
                href={info.mapsUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-start gap-1.5 transition-colors hover:text-gold-300"
              >
                <MapPin
                  className="mt-px size-3.5 shrink-0 text-gold-500"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <span>{address}</span>
              </a>
            )}
          </div>
        )}

        <div className="hairline my-4 opacity-30 lg:my-6" />

        {/* Info + policies · © */}
        <div className="flex flex-col items-center gap-2.5 text-[0.6rem] text-mute lg:flex-row lg:justify-between lg:text-[0.7rem]">
          <nav
            aria-label="Store information"
            className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 lg:order-2 lg:gap-x-5"
          >
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="uppercase tracking-[0.14em] transition-colors hover:text-gold-400"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="lg:order-1">© {site.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
