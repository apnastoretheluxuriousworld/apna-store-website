import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, Prose } from "@/components/ui/info-page";
import { ButtonLink } from "@/components/ui/button";
import { getStoreCategories } from "@/lib/data/categories";

export const metadata: Metadata = {
  title: "About Us",
  description: "Apna Store — The Luxurious World. Curated watches, perfumes, handbags, shoes and more from Kothagudem.",
};

const promises = [
  { title: "Curated, not crowded", body: "Every piece is chosen by hand for its finish, feel and presence — fewer things, chosen better." },
  { title: "Seen before it ships", body: "Each order is checked and packed with care, so it arrives the way it looked when we picked it." },
  { title: "A real store, real people", body: "Walk in, call or message us on WhatsApp — the same team that runs the shop answers you." },
];

export default async function AboutPage() {
  const categories = await getStoreCategories();
  return (
    <InfoPage eyebrow="Our Story" title="About Us" intro="Apna Store — The Luxurious World. A small store with a big idea: everyday luxury, within reach.">
      <Prose>
        <h2>Who we are</h2>
        <p>
          Apna Store began as a neighbourhood shop in the Jama Masjid Complex, Chinna Bazar, Kothagudem, and grew into a
          destination for people who care about the details — the weight of a watch, the trail of a fragrance, the stitch
          on a wallet.
        </p>
        <p>
          Today we bring that same counter online. Browse{" "}
          {categories.slice(0, 5).map((c, i, a) => (
            <span key={c.slug}>
              <Link href={`/shop/${c.slug}`}>{c.name.toLowerCase()}</Link>
              {i < a.length - 2 ? ", " : i === a.length - 2 ? " and " : ""}
            </span>
          ))}{" "}
          and more, and have it delivered to your door — or come and see it in person.
        </p>
      </Prose>

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {promises.map((p) => (
          <div key={p.title} className="rounded-xl border border-ink-600/70 bg-ink-850/60 p-5">
            <p className="font-serif text-lg text-gold-300">{p.title}</p>
            <p className="mt-2 text-xs leading-relaxed text-stone">{p.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/shop" size="lg">Explore the store</ButtonLink>
        <ButtonLink href="/contact" variant="outline" size="lg">Contact us</ButtonLink>
      </div>
    </InfoPage>
  );
}
