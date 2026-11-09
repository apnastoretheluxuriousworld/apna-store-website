import type { Metadata } from "next";
import { Suspense } from "react";
import { ShoppingBag } from "lucide-react";
import { AccountFrame, AccountSkeleton } from "@/components/account/account-frame";
import { OrderCard } from "@/components/account/order-card";
import { CustomerSignOutButton } from "@/components/account/sign-out-button";
import { ButtonLink } from "@/components/ui/button";
import { cacheLife } from "next/cache";
import { redirect } from "next/navigation";
import { currentUserView, requireCustomerView } from "@/lib/auth/session";
import { getMyOrders } from "@/lib/data/customers";
import { formatPrice } from "@/lib/format";
import { formatDate } from "@/lib/orders";
import { formatPhone } from "@/lib/validation/customer";

export const metadata: Metadata = { title: "My Account", robots: { index: false } };

export default function AccountPage() {
  return (
    <AccountFrame active="orders">
      <Suspense fallback={<AccountSkeleton />}>
        <Overview />
      </Suspense>
    </AccountFrame>
  );
}

/** Private-cached (browser only): switching tabs and coming back is instant. */
async function Overview() {
  "use cache: private";
  cacheLife("account");
  // The admin's session isn't a customer account: "My Account" takes them to the admin panel.
  if ((await currentUserView())?.role === "admin") redirect("/admin");
  const user = await requireCustomerView("/account");
  const orders = await getMyOrders(user.id);
  const firstName = user.name.split(" ")[0];
  const active = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
  const spent = orders.filter((o) => o.status !== "cancelled").reduce((n, o) => n + o.total, 0);

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-gold-500/20 bg-ink-850 p-5">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.16),transparent_70%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-serif text-2xl text-ivory">
              Hello, <em className="text-gold">{firstName}</em>
            </p>
            <p className="mt-1 text-xs text-stone">
              +91 {formatPhone(user.phone)} · Member since {formatDate(user.createdAt)}
            </p>
          </div>
          <CustomerSignOutButton />
        </div>
        <dl className="relative mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Orders", value: String(orders.length) },
            { label: "In progress", value: String(active) },
            { label: "Total spent", value: formatPrice(spent) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-ink-900/80 px-2 py-3">
              <dd className="font-medium text-ivory tabular-nums">{s.value}</dd>
              <dt className="mt-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-mute">{s.label}</dt>
            </div>
          ))}
        </dl>
      </div>

      <h2 className="mt-8 mb-3 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-ivory/80">Order history</h2>
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-600 px-6 py-14 text-center">
          <ShoppingBag className="mx-auto size-8 text-gold-500/70" strokeWidth={1.1} />
          <p className="mt-4 font-serif text-xl text-ivory">No orders yet</p>
          <p className="mt-1 text-sm text-stone">When you place an order, you can follow it here, step by step.</p>
          <ButtonLink href="/shop" className="mt-6">
            Start shopping
          </ButtonLink>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <OrderCard order={o} href={`/account/orders/${o.orderNumber}`} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
