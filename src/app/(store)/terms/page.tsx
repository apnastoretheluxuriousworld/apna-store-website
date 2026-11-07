import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/page-placeholder";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Policies"
      title="Terms of Service"
      description="The terms that govern purchases on Apna Store."
      feature="F12"
    />
  );
}
