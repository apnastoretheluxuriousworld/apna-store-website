import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Orders" };

export default async function Page() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Orders" description="Track and fulfil customer orders." />
      <ComingSoon feature="F10" what="Order list, details and delivery status updates" />
    </>
  );
}
