import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { FabLink, PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { listCouponsForAdmin } from "@/lib/data/coupons";
import { CouponList } from "./coupon-list";

export const metadata: Metadata = { title: "Coupons" };

export default async function CouponsPage() {
  await requireAdminView();
  const rows = await listCouponsForAdmin();
  const active = rows.filter((r) => r.status === "active").length;

  return (
    <>
      <PageHeader
        title="Coupons"
        description={rows.length ? `${active} active · ${rows.length} in all` : "Discount codes customers type at checkout"}
        actions={
          <Link
            href="/admin/influencers"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-ink-600 px-3 text-xs text-stone hover:border-gold-500/50 hover:text-gold-300"
          >
            <Megaphone className="size-3.5" /> Influencers
          </Link>
        }
      />
      <CouponList initial={rows} />
      <FabLink href="/admin/coupons/new" label="Create coupon" />
    </>
  );
}
