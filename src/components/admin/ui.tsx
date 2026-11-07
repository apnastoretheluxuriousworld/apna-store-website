import { Construction } from "lucide-react";
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
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
      className={cn("rounded-xl border border-ink-600/70 bg-ink-850 p-5", className)}
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
