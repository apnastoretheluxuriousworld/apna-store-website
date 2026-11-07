import Link from "next/link";
import { Construction, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 lg:mb-6">
      <div>
        <h1 className="font-serif text-3xl font-light text-ivory lg:text-4xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-ink-600/70 bg-ink-850 p-3.5 sm:p-4 lg:p-5", className)}
      {...props}
    />
  );
}

/** Stand-in for admin sections built in later features. */
export function ComingSoon({ feature, what }: { feature: string; what: string }) {
  return (
    <Card className="flex flex-col items-center py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full border border-gold-500/30 bg-gold-500/5">
        <Construction className="size-5 text-gold-400" strokeWidth={1.5} />
      </span>
      <p className="mt-4 text-sm text-ivory">{what}</p>
      <p className="mt-1 text-[0.65rem] uppercase tracking-[0.25em] text-mute">Arrives in {feature}</p>
    </Card>
  );
}

export function PanelSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-48 rounded bg-ink-800" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-24 rounded-xl bg-ink-850" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-ink-850" />
    </div>
  );
}

/** Round gold "+" pinned bottom-right, just above the mobile bottom bar. */
export function FabLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="bg-gold fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] z-30 grid size-14 place-items-center rounded-full text-ink-950 shadow-[0_10px_30px_-8px_rgba(212,175,55,0.7)] transition-transform hover:brightness-110 active:scale-95 lg:right-8 lg:bottom-8"
    >
      <Plus className="size-6" strokeWidth={2} />
    </Link>
  );
}
