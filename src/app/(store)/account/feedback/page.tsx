import type { Metadata } from "next";
import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { AccountFrame, AccountSkeleton } from "@/components/account/account-frame";
import { CustomerChat } from "@/components/feedback/customer-chat";
import { requireCustomerView } from "@/lib/auth/session";
import { getMyConversation } from "@/lib/data/feedback";

export const metadata: Metadata = { title: "Feedback", robots: { index: false } };

export default function FeedbackPage({ searchParams }: PageProps<"/account/feedback">) {
  return (
    <AccountFrame active="feedback">
      <Suspense fallback={<AccountSkeleton />}>
        <FeedbackContent searchParams={searchParams} />
      </Suspense>
    </AccountFrame>
  );
}

async function FeedbackContent({ searchParams }: Pick<PageProps<"/account/feedback">, "searchParams">) {
  const { order } = await searchParams;
  // From "Need help with this order?": start the message with the order number.
  const prefill = typeof order === "string" && /^[A-Za-z0-9-]{1,40}$/.test(order) ? `About order #${order}: ` : "";
  return <CachedChat prefill={prefill} />;
}

async function CachedChat({ prefill }: { prefill: string }) {
  "use cache: private";
  cacheLife("account");
  const user = await requireCustomerView("/account/feedback");
  const { conversationId, messages } = await getMyConversation(user.id);
  return <CustomerChat conversationId={conversationId} initial={messages} prefill={prefill} />;
}
