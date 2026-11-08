import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { Card, PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { listConversationsForAdmin } from "@/lib/data/feedback";
import { formatPhone } from "@/lib/validation/customer";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Feedback" };

const TZ = "Asia/Kolkata";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "numeric", month: "short" });

/** Today → time, otherwise the date (like a phone's chat list). */
function when(d: Date) {
  return dayKey.format(d) === dayKey.format(new Date()) ? timeFmt.format(d) : dateFmt.format(d);
}

export default async function FeedbackListPage() {
  await requireAdminView();
  const rows = await listConversationsForAdmin();

  return (
    <>
      <PageHeader title="Feedback" description="Conversations with signed-in customers. Replies reach them instantly." />
      {rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <MessagesSquare className="size-8 text-mute" strokeWidth={1.25} />
          <p className="text-sm text-ivory">No messages yet</p>
          <p className="max-w-xs text-xs text-mute">When a customer writes from My Account → Feedback, the conversation shows up here.</p>
        </Card>
      ) : (
        <ul className="divide-y divide-ink-600/60 overflow-hidden rounded-xl border border-ink-600/70 bg-ink-850">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/feedback/${c.id}`}
                className={cn("flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink-800", c.unread > 0 && "bg-gold-500/5")}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-gold-500/40 bg-ink-800 font-serif text-lg text-gold-300">
                  {c.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm", c.unread ? "font-medium text-ivory" : "text-ivory/90")}>{c.name}</span>
                    <span className={cn("shrink-0 text-[0.7rem]", c.unread ? "text-gold-300" : "text-mute")}>{when(c.lastMessageAt)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className={cn("truncate text-xs", c.unread ? "text-stone" : "text-mute")}>
                      {c.lastSender === "admin" && <span className="text-mute">You: </span>}
                      {c.preview}
                    </span>
                    {c.unread > 0 && (
                      <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-gold px-1.5 text-[0.65rem] font-semibold text-ink-950">
                        {c.unread}
                      </span>
                    )}
                  </span>
                  {c.phone && <span className="mt-0.5 block text-[0.65rem] text-mute">+91 {formatPhone(c.phone)}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
