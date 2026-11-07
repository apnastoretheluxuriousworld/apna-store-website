import { Emblem } from "@/components/brand/logo";
import { Reveal } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/ui/button";

/** Elegant stand-in for pages that are built in later features. */
export function PagePlaceholder({
  eyebrow,
  title,
  description,
  feature,
}: {
  eyebrow: string;
  title: string;
  description: string;
  feature: string;
}) {
  return (
    <section className="grain relative flex min-h-[80svh] items-center overflow-hidden pt-24 pb-16">
      <div
        aria-hidden
        className="absolute top-1/3 left-1/2 -z-0 size-[120vw] max-w-[800px] max-h-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.14),transparent_65%)]"
      />
      <Reveal className="relative mx-auto max-w-xl px-6 text-center">
        <Emblem className="mx-auto h-12 opacity-80" />
        <p className="eyebrow mt-8">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-5xl font-light text-ivory lg:text-6xl">{title}</h1>
        <div className="hairline mx-auto my-6 w-24" />
        <p className="text-sm leading-relaxed text-stone">{description}</p>
        <p className="mt-3 text-[0.65rem] uppercase tracking-[0.25em] text-mute">
          Arrives in {feature}
        </p>
        <ButtonLink href="/" variant="outline" className="mt-8">
          Back to home
        </ButtonLink>
      </Reveal>
    </section>
  );
}
