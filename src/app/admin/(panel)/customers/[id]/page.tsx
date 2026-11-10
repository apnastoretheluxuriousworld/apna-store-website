import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, MapPin, ReceiptText } from "lucide-react";
import { z } from "zod";
import { Card, PageHeader } from "@/components/admin/ui";
import { OrderCard } from "@/components/account/order-card";
import { requireAdminView } from "@/lib/auth/session";
import { getCustomerForAdmin } from "@/lib/data/customers";
import { formatPrice } from "@/lib/format";
import { formatDate, formatDateTime, timeAgo } from "@/lib/orders";
import { formatPhone } from "@/lib/validation/customer";
import { CustomerManage } from "./customer-manage";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  await requireAdminView();
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const c = await getCustomerForAdmin(id);
  if (!c) notFound();

  const stats = [
    { label: "Orders", value: String(c.stats.orders), sub: `${c.stats.open} in progress` },
    { label: "Total spent", value: formatPrice(c.stats.spent), sub: "excl. cancelled" },
    { label: "Avg. order", value: formatPrice(c.stats.average), sub: `${c.stats.delivered} delivered` },
    { label: "Last sign-in", value: timeAgo(c.lastLoginAt), sub: c.activeSessions ? `${c.activeSessions} device${c.activeSessions > 1 ? "s" : ""} signed in` : "Signed out" },
  ];

  const wa = c.phone ? `https://wa.me/91${c.phone}` : null;

  return (
    <>
      <Link href="/admin/customers" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> Customers
      </Link>
      <PageHeader
        title={c.name}
        description={`+91 ${formatPhone(c.phone)} · joined ${formatDate(c.createdAt)}${c.isBlocked ? " · Blocked" : ""}`}
        actions={
          c.phone ? (
            <>
              <a href={`tel:+91${c.phone}`} className="rounded-md border border-ink-600 px-3 py-2 text-xs text-stone hover:border-gold-500/40 hover:text-gold-300">
                Call
              </a>
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-md border border-ink-600 px-3 py-2 text-xs text-stone hover:border-gold-500/40 hover:text-gold-300">
                  WhatsApp
                </a>
              )}
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="py-3">
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-stone">{s.label}</p>
            <p className="mt-1 font-serif text-2xl text-ivory tabular-nums">{s.value}</p>
            <p className="text-xs text-mute">{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">
            <ReceiptText className="size-4 text-gold-400" strokeWidth={1.5} /> Order history
          </h2>
          {c.orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-600 py-12 text-center text-sm text-stone">No orders yet.</div>
          ) : (
            <ul className="space-y-2">
              {c.orders.map((o) => (
                <li key={o.id}>
                  <OrderCard order={o} href={`/admin/orders/${o.id}`} />
                </li>
              ))}
            </ul>
          )}

          {c.addresses.length > 0 && (
            <>
              <h2 className="mt-6 mb-3 flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">
                <MapPin className="size-4 text-gold-400" strokeWidth={1.5} /> Addresses
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {c.addresses.map((a, i) => (
                  <Card key={i} className="text-sm leading-relaxed text-stone">
                    <span className="text-ivory">{a.fullName}</span> · {formatPhone(a.phone)}
                    <br />
                    {[a.line1, a.line2, a.landmark && `Near ${a.landmark}`].filter(Boolean).join(", ")}
                    <br />
                    {a.city}, {a.state} {a.pincode}
                  </Card>
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <CustomerManage
            key={`${c.name}|${c.adminNote}|${c.isBlocked}`}
            customer={{ id: c.id, name: c.name, adminNote: c.adminNote ?? "", isBlocked: c.isBlocked, phone: c.phone }}
          />
          <Card>
            <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Activity</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {[
                ["Account created", formatDateTime(c.createdAt)],
                ["Last sign-in", c.lastLoginAt ? formatDateTime(c.lastLoginAt) : "Never"],
                ["Last order", c.orders[0] ? formatDateTime(c.orders[0].createdAt) : "—"],
                ["Cancelled orders", String(c.stats.cancelled)],
                ["Reviews written", String(c.reviews)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-stone">{k}</dt>
                  <dd className="text-right text-ivory">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </aside>
      </div>
    </>
  );
}
