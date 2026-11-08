import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { getCouponForEdit, listCouponCodes, listInfluencerOptions } from "@/lib/data/coupons";
import { COUPON_STATUS_LABEL, describeCoupon } from "@/lib/validation/coupon";
import { CouponForm } from "../coupon-form";

export const metadata: Metadata = { title: "Edit coupon" };

export default async function EditCouponPage({ params }: PageProps<"/admin/coupons/[id]">) {
  await requireAdminView();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [c, influencers, takenCodes] = await Promise.all([getCouponForEdit(id), listInfluencerOptions(), listCouponCodes()]);
  if (!c) notFound();
  const str = (n: number | null) => (n == null ? "" : String(n));

  return (
    <>
      <Link href="/admin/coupons" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> Coupons
      </Link>
      <PageHeader title={c.code} description={`${COUPON_STATUS_LABEL[c.status]} · ${describeCoupon(c)}`} />
      <CouponForm
        influencers={influencers}
        takenCodes={takenCodes}
        stats={{ uses: c.uses, sales: c.sales, discountGiven: c.discountGiven }}
        initial={{
          id: c.id,
          code: c.code,
          type: c.type,
          value: String(c.value),
          maxDiscount: str(c.maxDiscount),
          minOrder: c.minOrder ? String(c.minOrder) : "",
          maxUses: str(c.maxUses),
          perCustomerLimit: str(c.perCustomerLimit),
          firstOrderOnly: c.firstOrderOnly,
          influencerId: c.influencerId ?? "",
          note: c.note,
          startsOn: c.startsOn,
          endsOn: c.endsOn,
          isActive: c.isActive,
        }}
      />
    </>
  );
}
