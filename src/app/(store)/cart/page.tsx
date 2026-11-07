import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/page-placeholder";

export const metadata: Metadata = { title: "Shopping Bag" };

export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Your Bag"
      title="Shopping Bag"
      description="Review your selections and check out securely with Razorpay or cash on delivery."
      feature="F9"
    />
  );
}
