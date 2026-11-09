import type { Metadata } from "next";
import { FabLink, PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { listOffersForAdmin } from "@/lib/data/offers";
import { OfferList } from "./offer-list";

export const metadata: Metadata = { title: "Offers" };

export default async function OffersPage() {
  await requireAdminView();
  const rows = await listOffersForAdmin();
  const live = rows.filter((r) => r.status === "active").length;

  return (
    <>
      <PageHeader
        title="Offers"
        description={rows.length ? `${live} live · ${rows.length} in all` : "Combo deals like “Any 3 for ₹1,000”, shown under the Feed"}
      />
      <OfferList initial={rows} />
      <FabLink href="/admin/offers/new" label="Create offer" />
    </>
  );
}
