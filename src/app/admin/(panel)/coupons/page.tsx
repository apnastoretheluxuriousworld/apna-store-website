import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Coupons" };

export default async function Page() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Coupons" description="Discount codes." />
      <ComingSoon feature="F10" what="Create percent or flat discount codes" />
    </>
  );
}
