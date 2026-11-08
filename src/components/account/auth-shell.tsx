
/** Centered gold-on-black card used by the sign-in and sign-up pages. */
export function AuthShell({
  eyebrow,
  title,
  accent,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  /** Italic gold word after the title, e.g. "back". */
  accent: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <section className="grain relative flex min-h-[88svh] items-center justify-center overflow-hidden px-5 pt-24 pb-14">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/2 size-[120vw] max-h-200 max-w-200 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.14),transparent_65%)]"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-7 text-center">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 font-serif text-4xl font-light text-ivory">
            {title} <em className="text-gold font-normal">{accent}</em>
          </h1>
          <p className="mt-2 text-sm text-stone">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-gold-500/20 bg-ink-850/90 p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur sm:p-7">
          {children}
        </div>
        <div className="mt-6 text-center text-sm text-stone">{footer}</div>
      </div>
    </section>
  );
}
