import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/page-placeholder";

export const metadata: Metadata = { title: "My Account" };

export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Welcome"
      title="My Account"
      description="Sign in with your phone number to see orders, addresses and your wishlist."
      feature="F8"
    />
  );
}
