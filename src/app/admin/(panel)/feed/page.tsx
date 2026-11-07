import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/button";
import { requireAdminView } from "@/lib/auth/session";
import { listFeedForAdmin } from "@/lib/data/feed";
import { FEED_INPUT_ID } from "./constants";
import { FeedGrid } from "./feed-grid";

export const metadata: Metadata = { title: "Feed" };

export default async function FeedPage() {
  await requireAdminView();
  const rows = await listFeedForAdmin();
  const shown = rows.filter((r) => r.isActive).length;

  return (
    <>
      <PageHeader
        title="Feed"
        description={rows.length ? `${shown} live${rows.length > shown ? ` · ${rows.length - shown} hidden` : ""}` : undefined}
        actions={
          <label htmlFor={FEED_INPUT_ID} className={buttonClass("gold", "md", "cursor-pointer")}>
            <Plus className="size-4" /> Add videos
          </label>
        }
      />
      <FeedGrid initial={rows} />
    </>
  );
}
