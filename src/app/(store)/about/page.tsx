import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/page-placeholder";

export const metadata: Metadata = { title: "About Us" };

export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Our Story"
      title="About Us"
      description="The story behind Apna Store — The Luxurious World."
      feature="F12"
    />
  );
}
