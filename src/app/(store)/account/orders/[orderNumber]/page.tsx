import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { AccountFrame, AccountSkeleton } from "@/components/account/account-frame";
import { OrderView } from "@/components/account/order-view";
import { cacheLife } from "next/cache";
import { requireCustomerView } from "@/lib/auth/session";
import { getMyOrder } from "@/lib/data/customers";
import { getMyReviewedProductIds } from "@/lib/data/reviews";

export const metadata: Metadata = { title: "Order details", robots: { index: false } };

export default function OrderPage({ params }: PageProps<"/account/orders/[orderNumber]">) {
  return (
    <AccountFrame>
      <Link href="/account" className="mb-4 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> All orders
      </Link>
      <Suspense fallback={<AccountSkeleton />}>
        <OrderDetail params={params} />
      </Suspense>
    </AccountFrame>
  );
}

async function OrderDetail({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  return <CachedOrder orderNumber={orderNumber} />;
}

async function CachedOrder({ orderNumber }: { orderNumber: string }) {
  "use cache: private";
  cacheLife("account");
  const user = await requireCustomerView(`/account/orders/${encodeURIComponent(orderNumber)}`);
  if (!/^[A-Za-z0-9-]{1,40}$/.test(orderNumber)) notFound();
  const order = await getMyOrder(user.id, orderNumber);
  if (!order) notFound();

  const productIds = order.items.flatMap((i) => (i.productId ? [i.productId] : []));
  const reviewed = await getMyReviewedProductIds(user.id, productIds);

  return (
    <OrderView order={order} reviewed={reviewed} helpHref={`/account/feedback?order=${encodeURIComponent(order.orderNumber)}`} />
  );
}
