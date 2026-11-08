import type { Metadata } from "next";
import { FabLink, PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { listInfluencersForAdmin } from "@/lib/data/coupons";
import { formatPrice } from "@/lib/format";
import { InfluencerList } from "./influencer-list";

export const metadata: Metadata = { title: "Influencers" };

export default async function InfluencersPage() {
  await requireAdminView();
  const rows = await listInfluencersForAdmin();
  const owed = rows.reduce((n, r) => n + r.earned, 0);

  return (
    <>
      <PageHeader
        title="Influencers"
        description={
          rows.length
            ? `${rows.filter((r) => r.isActive).length} active${owed ? ` · ${formatPrice(owed)} commission earned in all` : ""}`
            : "People who promote the store with their own coupon codes"
        }
      />
      <InfluencerList initial={rows} />
      <FabLink href="/admin/influencers/new" label="Add influencer" />
    </>
  );
}
