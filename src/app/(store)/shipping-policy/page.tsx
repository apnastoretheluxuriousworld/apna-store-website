import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/page-placeholder";

/** Navigations here must show the page at once; `next dev` reports anything that blocks. */
export const instant = true;

export const metadata: Metadata = { title: "Shipping Policy" };

export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Policies"
      title="Shipping Policy"
      description="Delivery timelines, charges and coverage."
      feature="F12"
    />
  );
}
