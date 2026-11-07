import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { getFeedVideoForEdit } from "@/lib/data/feed";
import { FeedVideoForm } from "../feed-video-form";

export const metadata: Metadata = { title: "Edit video" };

export default async function EditFeedVideoPage({ params }: PageProps<"/admin/feed/[id]">) {
  await requireAdminView();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const v = await getFeedVideoForEdit(id);
  if (!v) notFound();

  return (
    <>
      <Link href="/admin/feed" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> Feed
      </Link>
      <PageHeader title="Edit video" />
      <FeedVideoForm initial={v} />
    </>
  );
}
