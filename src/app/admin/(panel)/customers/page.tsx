import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronRight, UserRound } from "lucide-react";
import { z } from "zod";
import { Card, PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { CUSTOMER_SORTS, listCustomersForAdmin } from "@/lib/data/customers";
import { formatPrice } from "@/lib/format";
import { formatDate, timeAgo } from "@/lib/orders";
import { formatPhone } from "@/lib/validation/customer";
import { CustomerFilters } from "./customer-filters";

export const metadata: Metadata = { title: "Customers" };

const filtersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  sort: z.enum(CUSTOMER_SORTS).optional().catch(undefined),
  blocked: z.literal("1").optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireAdminView();
  await connection(); // "last active" depends on the current time
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const filters = filtersSchema.parse({ q: one(sp.q), sort: one(sp.sort), blocked: one(sp.blocked), page: one(sp.page) });

  const { rows, total, page, pages, summary } = await listCustomersForAdmin({ ...filters, blocked: !!filters.blocked });
  const filtered = !!(filters.q || filters.blocked);

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, page: p > 1 ? p : undefined })) if (v) params.set(k, String(v));
    const qs = params.toString();
    return `/admin/customers${qs ? `?${qs}` : ""}`;
  };

  const stats = [
    { label: "Customers", value: summary.all },
    { label: "New · 30 days", value: summary.newThisMonth },
    { label: "Have ordered", value: summary.withOrders },
    { label: "Blocked", value: summary.blocked },
  ];

  return (
    <>
      <PageHeader title="Customers" description="Everyone who created an account on the store." />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="py-3">
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-stone">{s.label}</p>
            <p className="mt-1 font-serif text-2xl text-ivory tabular-nums">{s.value}</p>
          </Card>
        ))}
      </div>

      <CustomerFilters initial={{ q: filters.q, sort: filters.sort, blocked: filters.blocked }} />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-600 py-16 text-center">
          <p className="text-sm text-stone">
            {filtered ? "No customers match these filters." : "No customers yet. They appear here as soon as someone creates an account."}
          </p>
        </div>
      ) : (
        <>
          {filtered && <p className="mb-2 text-xs text-mute">{total} matching</p>}
          <Card className="overflow-hidden p-0 sm:p-0 lg:p-0">
            {/* Desktop table header */}
            <div className="hidden grid-cols-[minmax(0,2fr)_5rem_7rem_8rem_8rem_1rem] gap-4 border-b border-ink-600/70 px-5 py-3 text-[0.6rem] uppercase tracking-[0.2em] text-mute lg:grid">
              <span>Customer</span>
              <span className="text-right">Orders</span>
              <span className="text-right">Spent</span>
              <span>Last order</span>
              <span>Last sign-in</span>
              <span />
            </div>
            <ul className="divide-y divide-ink-600/60">
              {rows.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/customers/${c.id}`}
                    className="group flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-ink-800/60 sm:px-4 lg:grid lg:grid-cols-[minmax(0,2fr)_5rem_7rem_8rem_8rem_1rem] lg:gap-4 lg:px-5"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-gold-500/30 bg-ink-900 text-sm font-medium text-gold-300 uppercase">
                        {c.name.trim()[0] ?? <UserRound className="size-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm text-ivory">{c.name}</span>
                          {c.isBlocked && (
                            <span className="rounded-full border border-red-400/40 px-2 py-px text-[0.55rem] uppercase tracking-[0.16em] text-red-300">Blocked</span>
                          )}
                        </span>
                        <span className="block text-xs text-stone tabular-nums">
                          {formatPhone(c.phone)}
                          <span className="text-mute"> · joined {formatDate(c.createdAt)}</span>
                        </span>
                        {/* Mobile: stats under the name */}
                        <span className="mt-0.5 block text-xs text-mute lg:hidden">
                          {c.orders} order{c.orders === 1 ? "" : "s"} · {formatPrice(c.spent)} · active {timeAgo(c.lastLoginAt).toLowerCase()}
                        </span>
                      </span>
                    </span>
                    <span className="hidden text-right text-sm text-ivory tabular-nums lg:block">{c.orders}</span>
                    <span className="hidden text-right text-sm text-gold-300 tabular-nums lg:block">{formatPrice(c.spent)}</span>
                    <span className="hidden text-xs text-stone lg:block">{c.lastOrderAt ? formatDate(c.lastOrderAt) : "—"}</span>
                    <span className="hidden text-xs text-stone lg:block">{timeAgo(c.lastLoginAt)}</span>
                    <ChevronRight className="size-4 shrink-0 text-mute group-hover:text-gold-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="rounded-md border border-ink-600 px-3 py-1.5 text-stone hover:border-gold-500/40 hover:text-gold-300">
              ← Previous
            </Link>
          ) : null}
          <span className="text-mute">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="rounded-md border border-ink-600 px-3 py-1.5 text-stone hover:border-gold-500/40 hover:text-gold-300">
              Next →
            </Link>
          ) : null}
        </nav>
      )}
    </>
  );
}
