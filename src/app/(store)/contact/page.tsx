import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/page-placeholder";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Concierge"
      title="Contact"
      description="Reach our team for orders, styling advice and after-sales care."
      feature="F12"
    />
  );
}
