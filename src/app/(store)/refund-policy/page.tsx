import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/page-placeholder";

export const metadata: Metadata = { title: "Refund Policy" };

export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Policies"
      title="Refund Policy"
      description="Our returns, refunds and cancellation terms."
      feature="F12"
    />
  );
}
