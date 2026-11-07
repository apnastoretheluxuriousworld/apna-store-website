import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Homepage" };

export default async function Page() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Homepage" description="Hero slides, reels and testimonials." />
      <ComingSoon feature="F7" what="Manage and drag-reorder homepage content" />
    </>
  );
}
