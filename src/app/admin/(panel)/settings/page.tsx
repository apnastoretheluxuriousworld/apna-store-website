import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  await requireAdminView();
  return (
    <>
      <PageHeader title="Settings" />
      <ComingSoon feature="F10" what="COD minimum, shipping fee, WhatsApp number and store info" />
    </>
  );
}
