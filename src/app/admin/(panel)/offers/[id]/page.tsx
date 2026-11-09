import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { getOfferForEdit, listOfferProductOptions } from "@/lib/data/offers";
import { OFFER_STATUS_LABEL, describeOffer } from "@/lib/validation/offer";
import { OfferForm } from "../offer-form";

export const metadata: Metadata = { title: "Edit offer" };

export default async function EditOfferPage({ params }: PageProps<"/admin/offers/[id]">) {
  await requireAdminView();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [o, products] = await Promise.all([getOfferForEdit(id), listOfferProductOptions()]);
  if (!o) notFound();

  return (
    <>
      <Link href="/admin/offers" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> Offers
      </Link>
      <PageHeader
        title={o.title}
        description={`${OFFER_STATUS_LABEL[o.status]} · ${describeOffer({ pickCount: o.pickCount, price: o.price, productCount: o.productIds.length })}`}
        actions={
          o.status === "active" ? (
            <Link
              href={`/offers/${o.slug}`}
              target="_blank"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-ink-600 px-3 text-xs text-stone hover:border-gold-500/50 hover:text-gold-300"
            >
              <ExternalLink className="size-3.5" /> View in store
            </Link>
          ) : undefined
        }
      />
      <OfferForm
        products={products}
        sold={o.sold}
        initial={{
          id: o.id,
          coverUrl: o.coverUrl,
          title: o.title,
          description: o.description,
          pickCount: String(o.pickCount),
          price: String(o.price),
          productIds: o.productIds,
          startsOn: o.startsOn,
          endsOn: o.endsOn,
          isActive: o.isActive,
        }}
      />
    </>
  );
}
