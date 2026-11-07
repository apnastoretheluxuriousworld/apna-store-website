import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/page-placeholder";

export const metadata: Metadata = { title: "Search" };

export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Discover"
      title="Search"
      description="Find watches, fragrances, bags and more by name, brand or detail."
      feature="F6"
    />
  );
}
