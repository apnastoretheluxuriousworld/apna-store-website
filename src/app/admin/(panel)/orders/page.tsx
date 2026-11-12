import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ScanLine } from "lucide-react";
import { z } from "zod";
import { Card, PageHeader } from "@/components/admin/ui";
import { OrderThumbs } from "@/components/account/order-card";
import { OrderStatusBadge } from "@/components/account/order-status";
import { requireAdminView } from "@/lib/auth/session";
import { ORDER_TABS, listOrdersForAdmin, type AdminOrderRow, type OrderTab } from "@/lib/data/orders";
import { formatPrice } from "@/lib/format";
import { PAYMENT_LABEL, formatDateTime } from "@/lib/orders";
import { formatPhone } from "@/lib/validation/customer";
import { cn } from "@/lib/utils";
import { OrderSearch } from "./order-search";

export const metadata: Metadata = { title: "Orders" };

const filtersSchema = z.object({
  tab: z.enum(ORDER_TABS).catch("all"),
  q: z.string().trim().max(80).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

const TAB_LABEL: Record<OrderTab, string> = {
  verify: "Verify payment",
  new: "New",
  active: "In progress",
  delivered: "Delivered",
  cancelled: "Cancelled",
  all: "All",
};

function PaymentPill({ o }: { o: AdminOrderRow }) {
  const verify = o.paymentMethod === "upi" && o.paymentStatus === "pending" && o.status !== "cancelled";
  const tone =
    o.paymentStatus === "paid"
      ? "border-emerald-400/40 text-emerald-300"
      : o.paymentStatus === "failed"
        ? "border-red-400/40 text-red-300"
        : verify
          ? "border-amber-400/50 bg-amber-400/10 text-amber-200"
          : "border-ink-600 text-stone";
  const text =
    o.paymentStatus === "paid" ? "Paid" : o.paymentStatus === "failed" ? "Rejected" : verify ? "Verify" : o.paymentStatus === "refunded" ? "Refunded" : "Unpaid";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-px text-[0.58rem] uppercase tracking-[0.14em] whitespace-nowrap", tone)}>
      {verify && <ScanLine className="size-3" />}
      {PAYMENT_LABEL[o.paymentMethod]} · {text}
    </span>
  );
}

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdminView();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const f = filtersSchema.parse({ tab: one(sp.tab), q: one(sp.q), page: one(sp.page) });
  const { rows, total, page, pages, counts } = await listOrdersForAdmin(f);

  const href = (next: { tab?: OrderTab; page?: number }) => {
    const tab = next.tab ?? f.tab;
    const params = new URLSearchParams();
    if (tab !== "all") params.set("tab", tab);
    if (f.q && !next.tab) params.set("q", f.q);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    return `/admin/orders${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Orders" description="New orders, UPI payments to verify, and delivery progress." />

      <nav aria-label="Order filters" className="-mx-3 mb-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4 lg:mx-0 lg:px-0">
        {ORDER_TABS.map((t) => {
          const n = t in counts ? counts[t as keyof typeof counts] : 0;
          const active = f.tab === t;
          return (
            <Link
              key={t}
              href={href({ tab: t })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                active ? "border-gold-500/60 bg-gold-500/10 text-gold-200" : "border-ink-600 text-stone hover:border-gold-500/30 hover:text-ivory",
              )}
            >
              {TAB_LABEL[t]}
              {n > 0 && (
                <span
                  className={cn(
                    "grid min-w-5 place-items-center rounded-full px-1.5 text-[0.62rem] font-semibold tabular-nums",
                    t === "verify" ? "bg-amber-400 text-ink-950" : "bg-ink-700 text-ivory",
                  )}
                >
                  {n}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <OrderSearch key={f.tab} tab={f.tab} initial={f.q} />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-600 py-16 text-center">
          <p className="text-sm text-stone">
            {f.q ? "No orders match this search." : f.tab === "verify" ? "No payments waiting to be verified." : "No orders here yet."}
          </p>
        </div>
      ) : (
        <>
          {f.q && <p className="mb-2 text-xs text-mute">{total} matching</p>}
          <Card className="overflow-hidden p-0 sm:p-0 lg:p-0">
            <ul className="divide-y divide-ink-600/60">
              {rows.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="group flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-ink-800/60 sm:px-4 lg:px-5"
                  >
                    <OrderThumbs images={o.images} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="text-sm font-medium tracking-wide text-ivory">#{o.orderNumber}</span>
                        <OrderStatusBadge status={o.status} />
                        <PaymentPill o={o} />
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-stone">
                        {o.customerName} · {formatPhone(o.customerPhone)} · {o.city}
                      </span>
                      <span className="block truncate text-xs text-mute">
                        {o.firstItemName ?? "Order"}
                        {o.itemCount > 1 && ` + ${o.itemCount - 1} more`} · {formatDateTime(o.createdAt)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-medium text-gold-300 tabular-nums">{formatPrice(o.total)}</span>
                      <ChevronRight className="mt-1 ml-auto size-4 text-mute group-hover:text-gold-400" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link href={href({ page: page - 1 })} className="rounded-md border border-ink-600 px-3 py-1.5 text-stone hover:border-gold-500/40 hover:text-gold-300">
              ← Previous
            </Link>
          )}
          <span className="text-mute">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link href={href({ page: page + 1 })} className="rounded-md border border-ink-600 px-3 py-1.5 text-stone hover:border-gold-500/40 hover:text-gold-300">
              Next →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
