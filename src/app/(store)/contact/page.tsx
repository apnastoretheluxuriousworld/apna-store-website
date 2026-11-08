import type { Metadata } from "next";
import { Mail, MapPin, Phone } from "lucide-react";
import { InstagramIcon, WhatsappIcon, YoutubeIcon } from "@/components/brand/social-icons";
import { InfoPage } from "@/components/ui/info-page";
import { getStoreInfo } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Call, WhatsApp or visit Apna Store in Kothagudem for orders, product questions and after-sales care.",
};

type Item = { Icon: React.ComponentType<{ className?: string }>; label: string; lines: string[]; href: string; action: string };

export default async function ContactPage() {
  const info = await getStoreInfo();
  const items: Item[] = [
    ...info.phones.map((p, i) => ({
      Icon: Phone,
      label: i === 0 ? "Call us" : "Or call",
      lines: [p.label],
      href: `tel:${p.tel}`,
      action: "Call now",
    })),
    ...(info.whatsappUrl
      ? [{ Icon: WhatsappIcon, label: "WhatsApp", lines: ["Chat with us", "Orders, sizes, availability — message us any time."], href: info.whatsappUrl, action: "Open WhatsApp" }]
      : []),
    ...(info.email ? [{ Icon: Mail, label: "Email", lines: [info.email], href: `mailto:${info.email}`, action: "Write to us" }] : []),
    ...(info.instagram
      ? [{ Icon: InstagramIcon, label: "Instagram", lines: [info.instagram.handle, "New arrivals first, every day."], href: info.instagram.url, action: "Follow" }]
      : []),
    ...(info.youtubeUrl ? [{ Icon: YoutubeIcon, label: "YouTube", lines: ["Apna Store", "Unboxings and close-ups."], href: info.youtubeUrl, action: "Watch" }] : []),
  ];

  return (
    <InfoPage
      eyebrow="Concierge"
      title="Contact Us"
      intro="Questions about a piece, an order or a gift? We're a call or a message away."
      wide
    >
      <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ Icon, label, lines, href, action }) => (
          <a
            key={href}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="group flex items-center gap-4 rounded-xl border border-ink-600/70 bg-ink-850/60 p-4 transition-colors hover:border-gold-500/50 sm:flex-col sm:items-start sm:gap-0 sm:p-5"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-gold-500/40 text-gold-400">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1 sm:mt-4">
              <span className="block text-[0.65rem] uppercase tracking-[0.22em] text-gold-500">{label}</span>
              {lines.map((l, i) => (
                <span key={l} className={i === 0 ? "mt-0.5 block text-sm text-ivory tabular-nums" : "mt-0.5 hidden text-xs text-stone sm:block"}>
                  {l}
                </span>
              ))}
            </span>
            <span className="hidden pt-4 text-xs text-stone transition-colors group-hover:text-gold-300 sm:mt-auto sm:block">{action} →</span>
          </a>
        ))}
      </div>

      {info.addressLines.length > 0 && (
        <div className="mx-auto mt-3 max-w-4xl rounded-xl border border-ink-600/70 bg-ink-850/60 p-4 sm:flex sm:p-5 sm:items-center sm:justify-between sm:gap-6">
          <div className="flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-gold-500/40 text-gold-400">
              <MapPin className="size-4" strokeWidth={1.5} />
            </span>
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.22em] text-gold-500">Visit the store</p>
              {info.addressLines.map((l) => (
                <p key={l} className="mt-1 text-sm text-ivory">
                  {l}
                </p>
              ))}
            </div>
          </div>
          {info.mapsUrl && (
            <a
              href={info.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-11 items-center rounded-md border border-gold-500/60 px-5 text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase transition-colors hover:bg-gold-500/10 sm:mt-0 sm:shrink-0"
            >
              Get directions
            </a>
          )}
        </div>
      )}
    </InfoPage>
  );
}
