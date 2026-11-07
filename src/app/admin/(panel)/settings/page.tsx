import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Settings" description="Store details, COD and shipping." />
      <ComingSoon feature="F10" what="COD minimum, shipping fee, WhatsApp number and store info" />
    </>
  );
}
