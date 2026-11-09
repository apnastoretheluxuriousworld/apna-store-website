import Link from "next/link";
import { count, eq, sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { ArrowUpRight, FolderTree, Package, ReceiptText, Star, Users } from "lucide-react";
import { Card, PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { db, schema as s } from "@/lib/db";
import { countPendingReviews } from "@/lib/data/reviews";
import { getStorageUsage } from "@/lib/data/storage-usage";
import { StorageUsageCard } from "@/components/admin/storage-usage-card";
import { DashboardChartsView } from "@/components/admin/dashboard-charts";
import { getDashboardCharts } from "@/lib/data/dashboard";

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
        toVerify: sql<number>`count(*) filter (where ${s.orders.paymentMethod} = 'upi' and ${s.orders.paymentStatus} = 'pending' and ${s.orders.status} <> 'cancelled')::int`,
      })
      .from(s.orders),
    d.select({ n: count() }).from(s.users).where(eq(s.users.role, "customer")),
  ]);
  return { cats, prods, ords, custs };
}

export default async function AdminDashboard() {
  const user = await requireAdminView();
  const [{ cats, prods, ords, custs }, pendingReviews, storageUsage, charts] = await Promise.all([
    getStats(),
    countPendingReviews(),
    getStorageUsage(),
    getDashboardCharts(),
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

      <DashboardChartsView data={charts} />

      <div className="mt-3 lg:mt-5">
        <StorageUsageCard usage={storageUsage} />
      </div>
    </>
  );
}
