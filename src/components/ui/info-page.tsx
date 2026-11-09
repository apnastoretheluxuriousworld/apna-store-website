import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

/** Shared layout for About / Contact / policy pages: centred title block, then content. */
export function InfoPage({
  eyebrow,
  title,
  intro,
  updated,
  children,
  wide,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  /** "Last updated" line for policies. */
  updated?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="relative overflow-hidden pt-24 pb-16 lg:pt-36 lg:pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 size-[110vw] max-h-200 max-w-200 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.12),transparent_65%)]"
      />
      <Reveal className="relative mx-auto max-w-2xl px-5 text-center">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl font-light text-ivory lg:text-6xl">{title}</h1>
        <div className="hairline mx-auto my-5 w-20" />
        {intro && <p className="text-sm leading-relaxed text-stone lg:text-base">{intro}</p>}
        {updated && <p className="mt-3 text-[0.65rem] uppercase tracking-[0.2em] text-mute">Last updated {updated}</p>}
      </Reveal>
      <div className={cn("relative mx-auto mt-10 px-5 lg:mt-14", wide ? "max-w-site lg:px-12" : "max-w-2xl")}>{children}</div>
    </div>
  );
}

/** Readable long-form text (policies, About). */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "text-sm leading-relaxed text-stone lg:text-[0.95rem]",
        "[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-light [&_h2]:text-ivory first:[&_h2]:mt-0",
        "[&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_li]:marker:text-gold-500",
        "[&_a]:text-gold-300 [&_a]:underline-offset-4 hover:[&_a]:underline [&_strong]:font-medium [&_strong]:text-ivory",
      )}
    >
      {children}
    </div>
  );
}
