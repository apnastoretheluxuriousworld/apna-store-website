import { cn } from "@/lib/utils";

/*
 * Signature loader: the diamond "AS" emblem with a gold light running around
 * its facet outline, a shine sweeping across the emblem and corner glints.
 * Pure CSS/SVG (server component) — styles live in globals.css under "Brand loader".
 * Fades in after a short delay so quick navigations never flash it.
 */

// Diamond outline matching the emblem's silhouette (viewBox 200×160).
const DIAMOND = "M50 8 H150 L192 50 L100 152 L8 50 Z";

export function BrandLoader({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("brand-loader flex flex-col items-center", className)}
    >
      <span className="sr-only">{label}</span>

      <div aria-hidden className="relative aspect-5/4 w-40 sm:w-48">
        {/* Breathing glow behind the stone */}
        <div className="brand-loader-glow absolute inset-[-35%] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.28),transparent_62%)]" />

        {/* Slow orbit ring */}
        <svg viewBox="0 0 200 160" className="brand-loader-orbit absolute inset-[-18%] size-[136%] overflow-visible">
          <circle cx="100" cy="80" r="98" fill="none" stroke="url(#bl-gold)" strokeWidth="0.6" strokeDasharray="1 6" strokeLinecap="round" opacity="0.45" />
        </svg>

        {/* Facet outline + running light */}
        <svg viewBox="0 0 200 160" className="absolute inset-0 size-full overflow-visible">
          <defs>
            <linearGradient id="bl-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#b8860b" />
              <stop offset="45%" stopColor="#f8e7a8" />
              <stop offset="100%" stopColor="#d4af37" />
            </linearGradient>
          </defs>
          <path d={DIAMOND} fill="none" stroke="#d4af37" strokeOpacity="0.14" strokeWidth="1" strokeLinejoin="round" />
          <path d={DIAMOND} pathLength={100} fill="none" stroke="url(#bl-gold)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="brand-loader-trace" />
          <path d={DIAMOND} pathLength={100} fill="none" stroke="#f8e7a8" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" className="brand-loader-trace brand-loader-trace--b" />
        </svg>

        {/* Emblem + masked shine sweep */}
        <div className="brand-loader-stone absolute top-[25%] left-[24.5%] w-[51%] aspect-590/444">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static asset, also reused as the shine mask */}
          <img src="/brand/logo-emblem.png" alt="" width={590} height={444} className="size-full" />
          <div className="brand-loader-shine absolute inset-0" />
        </div>

        {/* Corner glints */}
        <Glint className="top-[5%] left-[75%] [animation-delay:0.4s]" />
        <Glint className="top-[31%] left-[4%] size-2.5 [animation-delay:1.5s]" />
        <Glint className="top-[93%] left-[50%] size-2 [animation-delay:2.3s]" />
      </div>
    </div>
  );
}

function Glint({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("brand-loader-glint absolute size-3", className)}>
      <path d="M12 0 C13 9 15 11 24 12 C15 13 13 15 12 24 C11 15 9 13 0 12 C9 11 11 9 12 0 Z" fill="#f8e7a8" />
    </svg>
  );
}

/** The brand loader centred in the page area — the fallback while a page's data loads. */
export function PageLoader({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex min-h-[55svh] items-center justify-center py-16", className)}>
      <BrandLoader label={label} />
    </div>
  );
}
