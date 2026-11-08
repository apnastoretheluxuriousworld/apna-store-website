import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { z } from "zod";
import { Card, PageHeader } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { requireAdminView } from "@/lib/auth/session";
import { getInfluencerForEdit } from "@/lib/data/coupons";
import { formatPrice } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE, formatDate } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { CouponList } from "../../coupons/coupon-list";
import { InfluencerForm } from "../influencer-form";

export const metadata: Metadata = { title: "Influencer" };

export default async function InfluencerPage({ params }: PageProps<"/admin/influencers/[id]">) {
  await requireAdminView();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const inf = await getInfluencerForEdit(id);
  if (!inf) notFound();
  const hasCommission = inf.commissionPercent > 0 || inf.earned > 0 || inf.pending > 0;

  return (
    <>
      <Link href="/admin/influencers" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> Influencers
      </Link>
      <PageHeader
        title={inf.name}
        description={[inf.handle && `@${inf.handle}`, inf.isActive ? "Active" : "Off", inf.commissionPercent > 0 && `${inf.commissionPercent}% commission`]
          .filter(Boolean)
          .join(" · ")}
      />

      <div className="space-y-3 lg:space-y-5">
        <dl className={cn("grid grid-cols-2 gap-2 lg:gap-3", hasCommission ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
          <Stat label="Orders" value={String(inf.orders)} hint="not counting cancelled" />
          <Stat label="Sales" value={formatPrice(inf.sales)} hint="items, after discount" />
          {!hasCommission && <Stat label="Discount given" value={formatPrice(inf.discount)} />}
          {hasCommission && <Stat label="Commission earned" value={formatPrice(inf.earned)} hint="on delivered orders" gold />}
          {hasCommission && <Stat label="Commission pending" value={formatPrice(inf.pending)} hint="orders not delivered yet" />}
        </dl>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Coupons</h2>
            <ButtonLink href={`/admin/coupons/new?influencer=${inf.id}`} size="sm">
              <Plus className="size-3.5" /> Create coupon
            </ButtonLink>
          </div>
          <CouponList initial={inf.coupons} emptyHref={`/admin/coupons/new?influencer=${inf.id}`} />
        </section>

        {inf.recentOrders.length > 0 && (
          <section>
            <h2 className="mb-2 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Orders with their codes</h2>
            <Card className="p-0 sm:p-0 lg:p-0">
              <ul className="divide-y divide-ink-600/60">
                {inf.recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-3.5 py-3 hover:bg-ink-800/50 sm:px-4">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm text-ivory">
                          #{o.orderNumber}
                          <span className={cn("rounded border px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider", STATUS_TONE[o.status])}>
                            {STATUS_LABEL[o.status]}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-mute">
                          {formatDate(o.createdAt)} · {o.customerName} · <span className="font-mono">{o.couponCode}</span>
                        </span>
                      </span>
                      <span className="text-right text-sm text-ivory tabular-nums">
                        {formatPrice(o.itemsPaid)}
                        {o.commission > 0 && (
                          <span className={cn("block text-[0.7rem]", o.status === "cancelled" ? "text-mute line-through" : "text-gold-300")}>
                            {formatPrice(o.commission)}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Details</h2>
          <InfluencerForm
            orders={inf.orders}
            initial={{
              id: inf.id,
              name: inf.name,
              handle: inf.handle,
              phone: inf.phone,
              commissionPercent: inf.commissionPercent ? String(inf.commissionPercent) : "",
              notes: inf.notes,
              isActive: inf.isActive,
            }}
          />
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, hint, gold }: { label: string; value: string; hint?: string; gold?: boolean }) {
  return (
    <div className="rounded-xl border border-ink-600/70 bg-ink-850 px-3.5 py-3">
      <dt className="text-[0.6rem] uppercase tracking-[0.18em] text-mute">{label}</dt>
      <dd className={cn("mt-1 font-serif text-2xl tabular-nums", gold ? "text-gold-300" : "text-ivory")}>{value}</dd>
      {hint && <p className="text-[0.65rem] text-mute">{hint}</p>}
    </div>
  );
}
