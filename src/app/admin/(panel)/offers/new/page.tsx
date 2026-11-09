import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { listOfferProductOptions } from "@/lib/data/offers";
import { OfferForm } from "../offer-form";

export const metadata: Metadata = { title: "Create offer" };

export default async function NewOfferPage() {
  await requireAdminView();
  const products = await listOfferProductOptions();
  return (
    <>
      <Link href="/admin/offers" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> Offers
      </Link>
      <PageHeader title="Create offer" />
      <OfferForm products={products} />
    </>
  );
}
