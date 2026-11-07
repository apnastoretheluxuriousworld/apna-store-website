import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Reviews" };

export default async function Page() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Reviews" description="Customer product reviews." />
      <ComingSoon feature="F11" what="Approve or hide customer reviews" />
    </>
  );
}
