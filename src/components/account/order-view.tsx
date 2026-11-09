import Image from "next/image";
import Link from "next/link";
import { AlertCircle, CircleCheck, Gift, PenLine, ExternalLink, Hourglass, MapPin, MessageCircle, Package, Truck, Wallet } from "lucide-react";
import { OrderStatusBadge, OrderTracker } from "@/components/account/order-status";
import { ProofResubmit } from "@/components/checkout/proof-resubmit";
import type { OrderDetail } from "@/lib/data/customers";
import { formatPrice } from "@/lib/format";
import { PAYMENT_LABEL, formatDateTime, paymentStatusText } from "@/lib/orders";
import { formatPhone } from "@/lib/validation/customer";
import { REVIEWABLE_ORDER_STATUSES } from "@/lib/validation/review";
import { cn } from "@/lib/utils";

/** One order, as the customer sees it (My Orders and the order's private link). */
export function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Package; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink-600/80 bg-ink-850 p-4 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-ivory/80">
        <Icon className="size-4 text-gold-400" strokeWidth={1.5} /> {title}
      </h2>
      {children}
    </section>
  );
}


/**
 * `reviewed`: signed-in customer's own order page only — products they have
 * already reviewed. When given, shipped/delivered items get a review link.
 */
export function OrderView({ order, reviewed, helpHref = "/contact" }: { order: OrderDetail; reviewed?: string[]; helpHref?: string }) {
  const a = order.shippingAddress;
  const canReview = !!reviewed && (REVIEWABLE_ORDER_STATUSES as readonly string[]).includes(order.status);
  const hasTracking = order.courierName || order.trackingNumber || order.trackingUrl;
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-serif text-3xl text-ivory">#{order.orderNumber}</p>
          <p className="mt-1 text-xs text-stone">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} className="text-[0.68rem]" />
      </div>

      <PaymentNotice order={order} />

      <Panel title="Tracking" icon={Truck}>
        <OrderTracker status={order.status} placedAt={order.createdAt} history={order.history} />
        {hasTracking && (
          <div className="mt-5 rounded-xl border border-gold-500/25 bg-gold-500/5 p-4">
            <p className="text-xs text-stone">
              Shipped with <span className="text-ivory">{order.courierName ?? "our courier partner"}</span>
            </p>
            {order.trackingNumber && (
              <p className="mt-1 text-sm text-ivory">
                Tracking no. <span className="font-mono tracking-wide text-gold-300 select-all">{order.trackingNumber}</span>
              </p>
            )}
            {order.trackingUrl && (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-950 hover:brightness-110"
              >
                Track shipment <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        )}
      </Panel>

      <Panel title={`Items (${itemCount})`} icon={Package}>
        <ul className="divide-y divide-ink-600/70">
          {order.items.map((i) => {
            const name = (
              <>
                <span className="block text-sm text-ivory">{i.name}</span>
                {i.variantLabel && <span className="block text-xs text-stone">{i.variantLabel}</span>}
              </>
            );
            return (
              <li key={i.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-ink-600 bg-ink-900">
                  {i.imageUrl ? (
                    <Image src={i.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                  ) : (
                    <Package className="m-auto mt-5 size-5 text-mute" strokeWidth={1.25} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  {i.slug ? (
                    <Link href={`/product/${i.slug}`} className="hover:[&>span:first-child]:text-gold-300">
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                  <span className="mt-0.5 block text-xs text-mute">
                    {formatPrice(i.unitPrice)} × {i.quantity}
                  </span>
                  {i.offerTitle && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded bg-gold-500/10 px-1.5 py-0.5 text-[0.65rem] text-gold-300">
                      <Gift className="size-3" strokeWidth={1.6} /> Offer: {i.offerTitle}
                    </span>
                  )}
                  {canReview && i.productId && (
                    <Link
                      href={`/account/reviews/${i.productId}`}
                      className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300 hover:underline"
                    >
                      <PenLine className="size-3.5" strokeWidth={1.5} />
                      {reviewed?.includes(i.productId) ? "Edit your review" : "Write a review"}
                    </Link>
                  )}
                </span>
                <span className="text-sm text-ivory tabular-nums">{formatPrice(i.unitPrice * i.quantity)}</span>
              </li>
            );
          })}
        </ul>
        <dl className="mt-4 space-y-1.5 border-t border-ink-600/70 pt-4 text-sm">
          <div className="flex justify-between text-stone">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatPrice(order.subtotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-emerald-300">
              <dt>Discount{order.couponCode && ` (${order.couponCode})`}</dt>
              <dd className="tabular-nums">−{formatPrice(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-stone">
            <dt>Shipping</dt>
            <dd className="tabular-nums">{order.shippingFee ? formatPrice(order.shippingFee) : "Free"}</dd>
          </div>
          {order.codFee > 0 && (
            <div className="flex justify-between text-stone">
              <dt>Cash on delivery charge</dt>
              <dd className="tabular-nums">{formatPrice(order.codFee)}</dd>
            </div>
          )}
          <div className="flex justify-between pt-1.5 text-base text-ivory">
            <dt>Total</dt>
            <dd className="font-medium text-gold-300 tabular-nums">{formatPrice(order.total)}</dd>
          </div>
        </dl>
        {order.returnFee != null && order.returnFee > 0 && (
          <p className="mt-3 text-xs text-mute">Return charge if sent back: {formatPrice(order.returnFee)}</p>
        )}
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Delivery address" icon={MapPin}>
          <address className="text-sm leading-relaxed text-stone not-italic">
            <span className="text-ivory">{a.fullName}</span>
            <br />
            {a.line1}
            {a.line2 && (
              <>
                <br />
                {a.line2}
              </>
            )}
            {a.landmark && (
              <>
                <br />
                Near {a.landmark}
              </>
            )}
            <br />
            {a.city}, {a.state} {a.pincode}
            <br />
            +91 {formatPhone(a.phone)}
          </address>
        </Panel>
        <Panel title="Payment" icon={Wallet}>
          <p className="text-sm text-ivory">{PAYMENT_LABEL[order.paymentMethod]}</p>
          <p className={cn("mt-1 text-xs", order.paymentStatus === "paid" ? "text-emerald-300" : "text-stone")}>
            {paymentStatusText(order.paymentMethod, order.paymentStatus)}
          </p>
          {order.paymentReference && <p className="mt-1 font-mono text-xs text-mute">UTR {order.paymentReference}</p>}
        </Panel>
      </div>

      <Link
        href={helpHref}
        className="flex items-center justify-center gap-2 rounded-2xl border border-ink-600/80 py-4 text-xs uppercase tracking-[0.18em] text-stone transition-colors hover:border-gold-500/40 hover:text-gold-300"
      >
        <MessageCircle className="size-4" strokeWidth={1.5} /> Need help with this order?
      </Link>
    </div>
  );
}

/** UPI orders: where the payment check stands, and a new upload if it was rejected. */
function PaymentNotice({ order }: { order: OrderDetail }) {
  if (order.paymentMethod !== "upi" || order.status === "cancelled") return null;
  if (order.paymentStatus === "pending") {
    return (
      <div className="flex gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
        <Hourglass className="mt-0.5 size-5 shrink-0 text-amber-200" strokeWidth={1.5} />
        <div>
          <p className="text-sm text-ivory">We’re verifying your payment</p>
          <p className="mt-1 text-xs leading-relaxed text-stone">
            We’ve received your screenshot for {formatPrice(order.total)}. Your order will be confirmed as soon as we’ve checked it — usually within a few hours.
          </p>
        </div>
      </div>
    );
  }
  if (order.paymentStatus === "paid") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4">
        <CircleCheck className="size-5 shrink-0 text-emerald-300" strokeWidth={1.5} />
        <p className="text-sm text-ivory">
          Payment received{order.paymentVerifiedAt && <span className="text-xs text-stone"> · {formatDateTime(order.paymentVerifiedAt)}</span>}
        </p>
      </div>
    );
  }
  if (order.paymentStatus === "failed") {
    return (
      <div className="rounded-2xl border border-red-400/40 bg-red-500/5 p-4">
        <p className="flex items-center gap-2 text-sm text-ivory">
          <AlertCircle className="size-5 shrink-0 text-red-300" strokeWidth={1.5} /> We couldn’t verify your payment
        </p>
        {order.paymentNote && <p className="mt-2 rounded-md bg-ink-900 px-3 py-2 text-xs text-stone">{order.paymentNote}</p>}
        <p className="mt-2 text-xs text-stone">
          If you’ve paid {formatPrice(order.total)}, please upload a clear screenshot of the successful payment. Otherwise, contact us and we’ll help.
        </p>
        {order.accessToken && (
          <div className="mt-4">
            <ProofResubmit token={order.accessToken} />
          </div>
        )}
      </div>
    );
  }
  return null;
}
