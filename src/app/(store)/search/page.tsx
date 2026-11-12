import type { Metadata } from "next";
import { SearchView } from "@/components/search/search-view";
import { getStoreCategories } from "@/lib/data/categories";

/** Navigations here must show the page at once; `next dev` reports anything that blocks. */
export const instant = true;

export const metadata: Metadata = { title: "Search", description: "Find watches, perfumes, handbags and more at Apna Store." };

/** Static shell; results load in place from /api/search as the customer types (see SearchView). */
export default async function SearchPage() {
  const categories = await getStoreCategories();
  return (
    <div className="mx-auto max-w-site px-4 pt-20 pb-16 lg:px-12 lg:pt-32">
      <SearchView categories={categories} />
    </div>
  );
}
