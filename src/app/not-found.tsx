import Link from "next/link";
import { Emblem } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-ink-950 px-6 text-center">
      <div>
        <Emblem className="mx-auto h-14" />
        <p className="eyebrow mt-8">Error 404</p>
        <h1 className="mt-3 font-serif text-5xl font-light text-ivory">Page not found</h1>
        <p className="mt-4 text-sm text-stone">The piece you are looking for is no longer here.</p>
        <Link
          href="/"
          className="mt-8 inline-block text-xs uppercase tracking-[0.25em] text-gold-400 hover:text-gold-300"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
