import { HardDrive } from "lucide-react";
import { Card } from "@/components/admin/ui";
import { R2_FREE_BYTES, type StorageUsage } from "@/lib/data/storage-usage";
import { cn } from "@/lib/utils";
import { RefreshStorageButton } from "./refresh-storage-button";

const FOLDER_LABELS: Record<string, string> = {
  products: "Product photos & videos",
  reels: "Feed videos",
  reviews: "Review photos & videos",
  testimonials: "Testimonials",
  hero: "Hero banners",
  categories: "Collection covers",
  payments: "Payment screenshots",
};

/** Decimal units (1 GB = 1000 MB), the way Cloudflare bills. */
export function formatBytes(bytes: number) {
  if (bytes >= 1000 ** 3) return `${(bytes / 1000 ** 3).toFixed(2)} GB`;
  if (bytes >= 1000 ** 2) return `${(bytes / 1000 ** 2).toFixed(1)} MB`;
  if (bytes >= 1000) return `${Math.round(bytes / 1000)} KB`;
  return `${bytes} B`;
}

const checkedTime = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Dashboard: how much of R2's free 10 GB the store's media uses. */
export function StorageUsageCard({ usage }: { usage: StorageUsage | null }) {
  if (!usage) {
    return (
      <Card className="flex items-center gap-3">
        <HardDrive className="size-4 text-mute" strokeWidth={1.5} />
        <p className="flex-1 text-sm text-stone">Couldn&apos;t read media storage size right now.</p>
        <RefreshStorageButton />
      </Card>
    );
  }

  const pct = (usage.totalBytes / R2_FREE_BYTES) * 100;
  const tone = pct >= 90 ? "red" : pct >= 70 ? "amber" : "green";
  const bar = { green: "bg-emerald-400", amber: "bg-amber-400", red: "bg-rose-400" }[tone];
  const text = { green: "text-emerald-400", amber: "text-amber-300", red: "text-rose-300" }[tone];
  const left = Math.max(0, R2_FREE_BYTES - usage.totalBytes);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">
          <HardDrive className="size-4 text-gold-400" strokeWidth={1.5} /> Media storage
        </h2>
        <RefreshStorageButton />
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-2">
        <p className="font-serif text-4xl text-ivory tabular-nums">{formatBytes(usage.totalBytes)}</p>
        <p className="text-sm text-stone">of 10 GB free</p>
        <p className={cn("ml-auto text-sm tabular-nums", text)}>{pct < 0.1 && pct > 0 ? "<0.1" : pct.toFixed(1)}% used</p>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-700" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.min(100, Math.max(pct, usage.totalBytes > 0 ? 1 : 0))}%` }} />
      </div>

      <p className={cn("mt-2 text-xs", tone === "green" ? "text-mute" : text)}>
        {tone === "red"
          ? pct >= 100
            ? "Over the free 10 GB — Cloudflare will bill the extra. Delete unused videos or old products to get back under."
            : `Only ${formatBytes(left)} left before Cloudflare starts billing. Remove unused videos or old products.`
          : tone === "amber"
            ? `${formatBytes(left)} left in the free tier. Videos take the most space — keep an eye on new uploads.`
            : `${formatBytes(left)} left in the free tier · ${usage.objects.toLocaleString("en-IN")} files`}
      </p>

      {usage.folders.length > 0 && (
        <ul className="mt-4 divide-y divide-ink-600/60 border-t border-ink-600/60">
          {usage.folders.map((f) => (
            <li key={f.folder} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-stone">
                {FOLDER_LABELS[f.folder] ?? f.folder}
                <span className="ml-2 text-xs text-mute">{f.objects.toLocaleString("en-IN")} files</span>
              </span>
              <span className="text-ivory tabular-nums">{formatBytes(f.bytes)}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[0.7rem] text-mute">Checked {checkedTime.format(new Date(usage.checkedAt))} · updates every hour</p>
    </Card>
  );
}
