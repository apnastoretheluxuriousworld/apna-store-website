import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, UserRound } from "lucide-react";
import { z } from "zod";
import { AdminChat } from "@/components/feedback/admin-chat";
import { requireAdminView } from "@/lib/auth/session";
import { getConversationForAdmin } from "@/lib/data/feedback";
import { formatPhone } from "@/lib/validation/customer";

export const metadata: Metadata = { title: "Feedback" };

export default async function ConversationPage({ params }: PageProps<"/admin/feedback/[id]">) {
  await requireAdminView();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const c = await getConversationForAdmin(id);
  if (!c) notFound();

  return (
    <>
      <Link href="/admin/feedback" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> Feedback
      </Link>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full border border-gold-500/40 bg-ink-800 font-serif text-xl text-gold-300">
            {c.name.trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-serif text-2xl text-ivory">{c.name}</h1>
            <p className="text-xs text-mute">
              {c.orders} order{c.orders === 1 ? "" : "s"}
              {c.phone && <> · +91 {formatPhone(c.phone)}</>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {c.phone && (
            <a
              href={`tel:+91${c.phone}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-600 px-3 text-xs text-stone hover:border-gold-500/40 hover:text-ivory"
            >
              <Phone className="size-3.5" /> Call
            </a>
          )}
          <Link
            href={`/admin/customers/${c.userId}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-600 px-3 text-xs text-stone hover:border-gold-500/40 hover:text-ivory"
          >
            <UserRound className="size-3.5" /> Customer
          </Link>
        </div>
      </div>
      <AdminChat key={c.id} conversationId={c.id} customerName={c.name} initial={c.messages} />
    </>
  );
}
