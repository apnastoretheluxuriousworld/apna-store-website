import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BadgeCheck, Bookmark } from "lucide-react";
import { AccountSkeleton } from "@/components/account/account-frame";
import { OrderView } from "@/components/account/order-view";
import { getCurrentUser } from "@/lib/auth/session";
import { getOrderByToken } from "@/lib/data/orders";

/** Navigations here must show the page at once; `next dev` reports anything that blocks. */
export const instant = true;

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

/**
 * An order's private page. Checkout lands here (?placed=1); guests keep the
 * link to follow their order and to send a new payment screenshot if needed.
 */
export default function OrderByLinkPage({ params, searchParams }: PageProps<"/order/[token]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-24 pb-16 lg:pt-36">
      <Suspense fallback={<AccountSkeleton />}>
        <OrderByLink params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function OrderByLink({ params, searchParams }: Pick<PageProps<"/order/[token]">, "params" | "searchParams">) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) notFound();
  const [order, user] = await Promise.all([getOrderByToken(token), getCurrentUser()]);
  if (!order) notFound();
  const justPlaced = sp.placed === "1";
  const mine = !!user && user.id === order.userId;

  return (
    <>
      {justPlaced && (
        <div className="mb-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-full border border-gold-500/40 bg-gold-500/10">
            <BadgeCheck className="size-8 text-gold-300" strokeWidth={1.3} />
          </span>
          <p className="eyebrow mt-5">Thank you, {order.customerName.split(" ")[0]}</p>
          <h1 className="mt-2 font-serif text-4xl font-light text-ivory lg:text-5xl">
            Order <em className="text-gold font-normal">placed</em>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-stone">
            {order.paymentMethod === "upi"
              ? "We'll confirm your order as soon as we've verified your payment."
              : "We'll call you to confirm before dispatch. Please keep the cash ready on delivery."}
          </p>
        </div>
      )}

      {!mine && (
        <p className="mb-4 flex items-start gap-2.5 rounded-xl border border-gold-500/20 bg-gold-500/5 px-4 py-3 text-xs leading-relaxed text-stone">
          <Bookmark className="mt-px size-4 shrink-0 text-gold-400" strokeWidth={1.5} />
          <span>
            Bookmark this page to follow your order — it&apos;s private to you.{" "}
            {!user && (
              <>
                Or{" "}
                <Link href="/account/signup" className="text-gold-400 hover:text-gold-300">
                  create an account
                </Link>{" "}
                to see all your orders in one place.
              </>
            )}
          </span>
        </p>
      )}

      <OrderView order={order} />

      {mine && (
        <Link href="/account" className="mt-4 block text-center text-xs uppercase tracking-[0.18em] text-stone hover:text-gold-300">
          All my orders
        </Link>
      )}
    </>
  );
}
