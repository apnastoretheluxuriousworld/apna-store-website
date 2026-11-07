import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Orders" };

export default async function Page() {
  await requireAdminView();
  return (
    <>
      <PageHeader title="Orders" />
      <ComingSoon feature="F10" what="Order list, details and delivery status updates" />
    </>
  );
}
