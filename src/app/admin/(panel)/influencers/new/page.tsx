import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { InfluencerForm } from "../influencer-form";

export const metadata: Metadata = { title: "Add influencer" };

export default async function NewInfluencerPage() {
  await requireAdminView();
  return (
    <>
      <Link href="/admin/influencers" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> Influencers
      </Link>
      <PageHeader title="Add influencer" description="Then create a coupon code for them to share." />
      <InfluencerForm />
    </>
  );
}
