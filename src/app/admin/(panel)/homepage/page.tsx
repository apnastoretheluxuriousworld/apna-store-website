import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Homepage" };

export default async function Page() {
  await requireAdminView();
  return (
    <>
      <PageHeader title="Homepage" />
      <ComingSoon feature="F7" what="Manage and drag-reorder homepage content" />
    </>
  );
}
