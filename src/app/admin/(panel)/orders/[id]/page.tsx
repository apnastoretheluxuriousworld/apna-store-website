import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { z } from "zod";
import { Card, PageHeader } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/account/order-status";
import { requireAdminView } from "@/lib/auth/session";
import { getOrderForAdmin } from "@/lib/data/customers";
import { formatPrice } from "@/lib/format";
import {
  PAYMENT_LABEL,
  PAYMENT_STATUS_LABEL,
  formatDateTime,
} from "@/lib/orders";
import { formatPhone } from "@/lib/validation/customer";
import { OrderManage } from "./order-manage";
import { PaymentReview } from "./payment-review";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage({
  params,
}: PageProps<"/admin/orders/[id]">) {
  await requireAdminView();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const o = await getOrderForAdmin(id);
  if (!o) notFound();
  const a = o.shippingAddress;

  return (
    <>
      <Link
        href={o.userId ? `/admin/customers/${o.userId}` : "/admin/orders"}
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400"
      >
        <ArrowLeft className="size-3.5" />{" "}
        {o.userId ? o.customerName : "Orders"}
      </Link>
      <PageHeader
        title={`#${o.orderNumber}`}
        description={`Placed ${formatDateTime(o.createdAt)}`}
        actions={<OrderStatusBadge status={o.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">
              Items
            </h2>
            <ul className="divide-y divide-ink-600/60">
              {o.items.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-ink-600 bg-ink-900">
                    {i.imageUrl ? (
                      <Image
                        src={i.imageUrl}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      <Package className="m-auto mt-4 size-5 text-mute" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    {i.productId ? (
                      <Link
                        href={`/admin/products/${i.productId}`}
                        className="block truncate text-sm text-ivory hover:text-gold-300"
                      >
                        {i.name}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm text-ivory">
                        {i.name}
                      </span>
                    )}
                    <span className="block text-xs text-stone">
                      {i.variantLabel && `${i.variantLabel} · `}
                      {formatPrice(i.unitPrice)} × {i.quantity}
                    </span>
                  </span>
                  <span className="text-sm text-ivory tabular-nums">
                    {formatPrice(i.unitPrice * i.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 border-t border-ink-600/60 pt-3 text-sm">
              <div className="flex justify-between text-stone">
                <dt>Subtotal</dt>
                <dd>{formatPrice(o.subtotal)}</dd>
              </div>
              {o.discount > 0 && (
                <div className="flex justify-between text-emerald-300">
                  <dt>
                    Discount
                    {o.couponCode &&
                      (o.couponId ? (
                        <>
                          {" ("}
                          <Link href={`/admin/coupons/${o.couponId}`} className="underline-offset-2 hover:underline">
                            {o.couponCode}
                          </Link>
                          {")"}
                        </>
                      ) : (
                        ` (${o.couponCode})`
                      ))}
                  </dt>
                  <dd>−{formatPrice(o.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between text-stone">
                <dt>Shipping</dt>
                <dd>{o.shippingFee ? formatPrice(o.shippingFee) : "Free"}</dd>
              </div>
              {o.codFee > 0 && (
                <div className="flex justify-between text-stone">
                  <dt>Cash on delivery charge</dt>

                  <dd>{formatPrice(o.codFee)}</dd>
                </div>
              )}
              <div className="flex justify-between text-base text-ivory">
                <dt>Total</dt>
                <dd className="text-gold-300">{formatPrice(o.total)}</dd>
              </div>
            </dl>
            {o.influencerId && (
              <p className="mt-3 rounded-lg bg-ink-900 px-3 py-2 text-xs text-stone">
                Via influencer{" "}
                <Link href={`/admin/influencers/${o.influencerId}`} className="text-gold-300 hover:underline">
                  {o.influencerName ?? "—"}
                </Link>
                {o.commission > 0 &&
                  ` · ${formatPrice(o.commission)} commission${o.status === "delivered" ? "" : o.status === "cancelled" ? " (cancelled, not owed)" : " once delivered"}`}
              </p>
            )}
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="text-sm leading-relaxed text-stone">
              <h2 className="mb-2 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">
                Ship to
              </h2>
              <span className="text-ivory">{a.fullName}</span> · +91{" "}
              {formatPhone(a.phone)}
              <br />
              {[a.line1, a.line2, a.landmark && `Near ${a.landmark}`]
                .filter(Boolean)
                .join(", ")}
              <br />
              {a.city}, {a.state} {a.pincode}
            </Card>
            <Card className="text-sm text-stone">
              <h2 className="mb-2 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">
                Customer &amp; payment
              </h2>
              {o.userId ? (
                <Link
                  href={`/admin/customers/${o.userId}`}
                  className="text-ivory hover:text-gold-300"
                >
                  {o.customerName}
                </Link>
              ) : (
                <span className="text-ivory">{o.customerName} (guest)</span>
              )}
              <span className="block">+91 {formatPhone(o.customerPhone)}</span>
              <span className="mt-2 block">
                {PAYMENT_LABEL[o.paymentMethod]} ·{" "}
                <span className="text-ivory">
                  {PAYMENT_STATUS_LABEL[o.paymentStatus]}
                </span>
              </span>
              {o.razorpayPaymentId && (
                <span className="block font-mono text-xs text-mute">
                  {o.razorpayPaymentId}
                </span>
              )}
              {o.returnFee != null && o.returnFee > 0 && (
                <span className="mt-1 block text-xs text-mute">
                  Return charge shown at checkout: {formatPrice(o.returnFee)}
                </span>
              )}
              {o.codConsentAt && (
                <span className="mt-1 block text-xs text-mute">
                  Customer agreed to pay cash on delivery ·{" "}
                  {formatDateTime(o.codConsentAt)}
                </span>
              )}
              {o.notes && (
                <span className="mt-2 block rounded-md bg-ink-900 px-2.5 py-1.5 text-xs">
                  Note: {o.notes}
                </span>
              )}
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          {o.paymentMethod === "upi" && (
            <PaymentReview
              key={`${o.paymentStatus}|${o.paymentProofUrl}`}
              id={o.id}
              total={o.total}
              cancelled={o.status === "cancelled"}
              paymentStatus={o.paymentStatus}
              proofUrl={o.paymentProofUrl}
              reference={o.paymentReference}
              note={o.paymentNote}
              verifiedAt={o.paymentVerifiedAt?.toISOString() ?? null}
            />
          )}
          <OrderManage
            key={`${o.status}|${o.history.length}|${o.trackingNumber}|${o.courierName}|${o.trackingUrl}`}
            order={{
              id: o.id,
              status: o.status,
              createdAt: o.createdAt.toISOString(),
              history: o.history.map((h) => ({
                ...h,
                createdAt: h.createdAt.toISOString(),
              })),
              courierName: o.courierName ?? "",
              trackingNumber: o.trackingNumber ?? "",
              trackingUrl: o.trackingUrl ?? "",
            }}
          />
        </div>
      </div>
    </>
  );
}
