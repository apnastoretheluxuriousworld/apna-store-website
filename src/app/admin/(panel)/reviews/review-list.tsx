"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BadgeCheck, ImageOff, Pin, Trash2, UserRound } from "lucide-react";
import { ConfirmDialog, Switch } from "@/components/admin/form";
import { ReviewMediaStrip } from "@/components/reviews/media-viewer";
import { Stars } from "@/components/reviews/stars";
import type { AdminReviewRow } from "@/lib/data/reviews";
import { deleteReview, setReviewApproved, setReviewPinned } from "./actions";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export function ReviewList({ initial }: { initial: AdminReviewRow[] }) {
  const [rows, setRows] = useState(initial);
  const [, startTransition] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [toDelete, setToDelete] = useState<AdminReviewRow | null>(null);

  function patch(id: string, change: Partial<AdminReviewRow>, action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));
    startTransition(async () => {
      const res = await action();
      if (res.ok) toast.success(success);
      else {
        setRows(prev);
        toast.error(res.error ?? "Something went wrong");
      }
    });
  }

  function confirmDelete() {
    const r = toDelete;
    if (!r) return;
    startDeleting(async () => {
      const res = await deleteReview(r.id);
      setToDelete(null);
      if (!res.ok) return void toast.error(res.error);
      setRows((rs) => rs.filter((x) => x.id !== r.id));
      toast.success("Review deleted");
    });
  }

  return (
    <>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li
            key={r.id}
            className={cn(
              "rounded-xl border bg-ink-850 p-3.5 sm:p-4",
              r.isApproved ? "border-ink-600/70" : "border-gold-500/35",
            )}
          >
            <div className="flex items-start gap-3">
              <Link
                href={`/admin/products/${r.productId}`}
                className="relative grid h-15 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-ink-600 bg-ink-900"
                title={`Edit ${r.productName}`}
              >
                {r.productImage ? (
                  <Image src={r.productImage} alt="" fill sizes="48px" unoptimized className="object-cover" />
                ) : (
                  <ImageOff className="size-4 text-mute" strokeWidth={1.25} />
                )}
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Stars rating={r.rating} size="size-3" />
                  {!r.isApproved && (
                    <span className="rounded bg-gold-500/15 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-gold-300">Pending</span>
                  )}
                  {r.isPinned && (
                    <span className="inline-flex items-center gap-1 text-[0.6rem] uppercase tracking-wider text-stone">
                      <Pin className="size-3" /> Pinned
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-xs text-mute">
                  on <span className="text-stone">{r.productName}</span>
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-ivory">
                  {r.authorName}
                  {r.isVerified && <BadgeCheck className="size-3.5 text-gold-400" aria-label="Verified buyer" strokeWidth={1.5} />}
                  {r.fromCustomer && <UserRound className="size-3.5 text-mute" aria-label="From a customer account" strokeWidth={1.5} />}
                  <span className="text-xs text-mute">
                    {r.city && <>· {r.city} </>}· {dateFmt.format(r.createdAt)}
                  </span>
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-center gap-1">
                <Switch
                  checked={r.isApproved}
                  onChange={(v) =>
                    patch(r.id, { isApproved: v }, () => setReviewApproved(r.id, v), v ? "Published on the product page" : "Hidden from the store")
                  }
                  label={`Publish review by ${r.authorName}`}
                />
                <span className="text-[0.55rem] uppercase tracking-wider text-mute">{r.isApproved ? "Live" : "Off"}</span>
              </div>
            </div>

            {r.body && <p className="mt-3 line-clamp-4 text-sm leading-relaxed whitespace-pre-line text-ivory/85">{r.body}</p>}
            {r.media.length > 0 && (
              <div className="mt-3">
                <ReviewMediaStrip media={r.media} label={`from ${r.authorName}`} thumbClassName="size-14 rounded-lg" />
              </div>
            )}

            <div className="mt-3 flex items-center justify-end gap-1 border-t border-ink-600/50 pt-2">
              <button
                type="button"
                aria-pressed={r.isPinned}
                onClick={() => patch(r.id, { isPinned: !r.isPinned }, () => setReviewPinned(r.id, !r.isPinned), r.isPinned ? "Unpinned" : "Pinned to the top")}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs hover:bg-ink-800",
                  r.isPinned ? "text-gold-300" : "text-stone hover:text-ivory",
                )}
              >
                <Pin className={cn("size-3.5", r.isPinned && "fill-gold-400")} /> {r.isPinned ? "Pinned" : "Pin"}
              </button>
              <button
                type="button"
                onClick={() => setToDelete(r)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-stone hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this review?"
        body={<>The review by “{toDelete?.authorName}” and its photos/videos will be removed permanently.</>}
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
