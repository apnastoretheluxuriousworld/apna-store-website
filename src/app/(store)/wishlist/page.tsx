import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/page-placeholder";

export const metadata: Metadata = { title: "Wishlist" };

export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Saved"
      title="Wishlist"
      description="Keep the pieces you love, ready for when the moment is right."
      feature="F8"
    />
  );
}
