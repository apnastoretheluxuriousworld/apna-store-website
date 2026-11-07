import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Coupons" };

export default async function Page() {
  await requireAdminView();
  return (
    <>
      <PageHeader title="Coupons" />
      <ComingSoon feature="F10" what="Create percent or flat discount codes" />
    </>
  );
}
