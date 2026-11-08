import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { listCouponCodes, listInfluencerOptions } from "@/lib/data/coupons";
import { CouponForm } from "../coupon-form";

export const metadata: Metadata = { title: "Create coupon" };

/** ?influencer=<id> (from an influencer's page) picks them in advance. */
export default async function NewCouponPage({ searchParams }: PageProps<"/admin/coupons/new">) {
  await requireAdminView();
  const [{ influencer }, influencers, takenCodes] = await Promise.all([searchParams, listInfluencerOptions(), listCouponCodes()]);
  const pre = typeof influencer === "string" && z.uuid().safeParse(influencer).success ? influencer : "";
  return (
    <>
      <Link href="/admin/coupons" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> Coupons
      </Link>
      <PageHeader title="Create coupon" />
      <CouponForm influencers={influencers} takenCodes={takenCodes} defaultInfluencerId={influencers.some((i) => i.id === pre) ? pre : ""} />
    </>
  );
}
