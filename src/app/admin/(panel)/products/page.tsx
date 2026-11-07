import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Products" };

export default async function Page() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Products" description="Your catalogue." />
      <ComingSoon feature="F5" what="Add products with images, variants and category fields" />
    </>
  );
}
