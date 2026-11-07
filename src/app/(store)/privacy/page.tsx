import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/page-placeholder";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Policies"
      title="Privacy Policy"
      description="How we collect, use and protect your information."
      feature="F12"
    />
  );
}
