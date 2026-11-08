import { cacheLife } from "next/cache";
import { currentUserView } from "@/lib/auth/session";
import { getMyUnreadReplies } from "@/lib/data/feedback";

/**
 * Unread replies on the account's Feedback tab. Private-cached like the
 * account pages, so switching tabs stays instant; opening Feedback or a full
 * page load shows the current count.
 */
export async function FeedbackTabBadge() {
  "use cache: private";
  cacheLife("account");
  const user = await currentUserView();
  if (user?.role !== "customer") return null;
  const { unread } = await getMyUnreadReplies(user.id).catch(() => ({ unread: 0 }));
  if (!unread) return null;
  return (
    <span aria-label={`${unread} new`} className="ml-1.5 inline-grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[0.6rem] font-semibold tracking-normal text-ink-950">
      {unread}
    </span>
  );
}
