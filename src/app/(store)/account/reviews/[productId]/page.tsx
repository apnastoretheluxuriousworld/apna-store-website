import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Package } from "lucide-react";
import { cacheLife } from "next/cache";
import { z } from "zod";
import { AccountFrame, AccountSkeleton } from "@/components/account/account-frame";
import { ReviewForm } from "@/components/reviews/review-form";
import { requireCustomerView } from "@/lib/auth/session";
import { getReviewTarget } from "@/lib/data/reviews";

export const metadata: Metadata = { title: "Write a review", robots: { index: false } };

export default function ReviewPage({ params }: PageProps<"/account/reviews/[productId]">) {
  return (
    <AccountFrame>
      <Link href="/account" className="mb-4 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> My orders
      </Link>
      <Suspense fallback={<AccountSkeleton />}>
        <ReviewContent params={params} />
      </Suspense>
    </AccountFrame>
  );
}

async function ReviewContent({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  return <CachedReview productId={productId} />;
}

async function CachedReview({ productId }: { productId: string }) {
  "use cache: private";
  cacheLife("account");
  const user = await requireCustomerView(`/account/reviews/${encodeURIComponent(productId)}`);
  if (!z.uuid().safeParse(productId).success) notFound();
  const target = await getReviewTarget(user.id, productId);

  if (!target) {
    return (
      <div className="rounded-2xl border border-dashed border-gold-500/25 px-5 py-10 text-center">
        <p className="text-sm text-ivory">You can review this product once your order has shipped.</p>
        <Link href="/account" className="mt-3 inline-block text-xs text-gold-400 hover:underline">
          Go to my orders
        </Link>
      </div>
    );
  }

  const { product, review } = target;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <span className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-ink-600 bg-ink-900">
          {product.image ? (
            <Image src={product.image} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <Package className="m-auto mt-5 size-5 text-mute" strokeWidth={1.25} />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-stone">{review ? "Edit your review" : "Write a review"}</p>
          <p className="mt-1 truncate font-serif text-2xl text-ivory">{product.name}</p>
        </div>
      </div>
      <ReviewForm productId={product.id} initial={review} />
    </div>
  );
}
