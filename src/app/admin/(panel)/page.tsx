import Link from "next/link";
import { count, eq, sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { ArrowUpRight, CheckCircle2, CircleDashed, FolderTree, Package, ReceiptText, Star, Users } from "lucide-react";
import { Card, PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { db, schema as s } from "@/lib/db";
import { storage } from "@/lib/storage";
import { formatPrice } from "@/lib/format";
import { countPendingReviews } from "@/lib/data/reviews";
import { getStorageUsage } from "@/lib/data/storage-usage";
import { StorageUsageCard } from "@/components/admin/storage-usage-card";

/** Private-cached: kept with the page in the admin's browser (see the `admin` profile). */
async function getStats() {
  "use cache: private";
  cacheLife("admin");
  const d = db();
  const [[cats], [prods], [ords], [custs]] = await Promise.all([
    d.select({ n: count() }).from(s.categories),
    d
      .select({
        n: count(),
        active: sql<number>`count(*) filter (where ${s.products.status} = 'active')::int`,
      })
      .from(s.products),
    d
      .select({
        n: count(),
        pending: sql<number>`count(*) filter (where ${s.orders.status} in ('placed','confirmed','packed'))::int`,
        revenue: sql<number>`coalesce(sum(${s.orders.total}) filter (where ${s.orders.paymentStatus} = 'paid'), 0)::int`,
        toVerify: sql<number>`count(*) filter (where ${s.orders.paymentMethod} = 'upi' and ${s.orders.paymentStatus} = 'pending' and ${s.orders.status} <> 'cancelled')::int`,
      })
      .from(s.orders),
    d.select({ n: count() }).from(s.users).where(eq(s.users.role, "customer")),
  ]);
  return { cats, prods, ords, custs };
}

async function storageReady() {
  "use cache: private";
  cacheLife("admin");
  try {
    await storage.ping();
    return true;
  } catch {
    return false;
  }
}

export default async function AdminDashboard() {
  const user = await requireAdminView();
  const [{ cats, prods, ords, custs }, storageOk, pendingReviews, storageUsage] = await Promise.all([
    getStats(),
    storageReady(),
    countPendingReviews(),
    getStorageUsage(),
  ]);

  const stats = [
    { label: "Categories", value: cats.n, sub: "collections", icon: FolderTree, href: "/admin/categories" },
    { label: "Products", value: prods.n, sub: `${prods.active} live`, icon: Package, href: "/admin/products" },
    {
      label: "Orders",
      value: ords.n,
      sub: ords.toVerify ? `${ords.toVerify} payment${ords.toVerify > 1 ? "s" : ""} to verify` : `${ords.pending} to fulfil`,
      icon: ReceiptText,
      href: ords.toVerify ? "/admin/orders?tab=verify" : "/admin/orders",
    },
    { label: "Customers", value: custs.n, sub: "registered", icon: Users, href: "/admin/customers" },
  ];

  const checklist = [
    { done: true, label: "Database connected", note: "Supabase Postgres" },
    { done: cats.n > 0, label: "Categories set up", note: `${cats.n} categories` },
    { done: storageOk, label: "Media storage connected", note: storageOk ? "Cloudflare R2" : "Add R2 keys to .env (SETUP.md §2)" },
    { done: prods.active > 0, label: "First product live", note: prods.active > 0 ? `${prods.active} live` : "Add a product and switch it to Live" },
  ];

  const first = user.name.split(" ")[0];

  return (
    <>
      <PageHeader title={`Welcome, ${first}`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map(({ label, value, sub, icon: Icon, href }) => (
          <Link key={label} href={href} className="group">
            <Card className="h-full transition-colors group-hover:border-gold-500/30">
              <div className="flex items-center justify-between">
                <span className="text-[0.65rem] uppercase tracking-[0.2em] text-stone">{label}</span>
                <Icon className="size-4 text-gold-400" strokeWidth={1.5} />
              </div>
              <p className="mt-3 font-serif text-4xl text-ivory tabular-nums">{value}</p>
              <p className="mt-1 text-xs text-mute">{sub}</p>
            </Card>
          </Link>
        ))}
      </div>

      {pendingReviews > 0 && (
        <Link href="/admin/reviews?status=pending" className="group mt-3 block lg:mt-5">
          <Card className="flex items-center gap-4 border-gold-500/30 bg-gold-500/5 transition-colors group-hover:border-gold-500/50">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-500/15">
              <Star className="size-4.5 text-gold-400" strokeWidth={1.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ivory">
                {pendingReviews} review{pendingReviews > 1 ? "s" : ""} to approve
              </span>
              <span className="block text-xs text-mute">From customers. Hidden from the store until you publish.</span>
            </span>
            <ArrowUpRight className="size-4 text-gold-400" />
          </Card>
        </Link>
      )}

      <div className="mt-3 grid gap-3 lg:mt-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Revenue</h2>
            <span className="text-xs text-mute">paid orders</span>
          </div>
          <p className="text-gold mt-4 font-serif text-5xl">{formatPrice(ords.revenue)}</p>
          <p className="mt-2 text-sm text-stone">
            {ords.n === 0 ? "No orders yet — they'll appear here once checkout goes live (F9)." : `${ords.n} orders in total.`}
          </p>
        </Card>

        <Card>
          <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Store setup</h2>
          <ul className="mt-4 space-y-3">
            {checklist.map((c) => (
              <li key={c.label} className="flex gap-3">
                {c.done ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" strokeWidth={1.75} />
                ) : (
                  <CircleDashed className="mt-0.5 size-4 shrink-0 text-mute" strokeWidth={1.75} />
                )}
                <span>
                  <span className={c.done ? "block text-sm text-ivory" : "block text-sm text-stone"}>{c.label}</span>
                  <span className="block text-xs text-mute">{c.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-3 lg:mt-5">
        <StorageUsageCard usage={storageUsage} />
      </div>

      <Card className="mt-4 lg:mt-6">
        <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Quick links</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            { label: "Manage categories", href: "/admin/categories" },
            { label: "Add a product", href: "/admin/products" },
            { label: "Customer feedback", href: "/admin/feedback" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center justify-between rounded-lg border border-ink-600/70 px-4 py-3 text-sm text-stone transition-colors hover:border-gold-500/30 hover:text-gold-300"
            >
              {l.label}
              <ArrowUpRight className="size-4" strokeWidth={1.5} />
            </Link>
          ))}
        </div>
      </Card>
    </>
  );
}
