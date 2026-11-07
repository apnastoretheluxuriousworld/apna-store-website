import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { listReviewsForAdmin } from "@/lib/data/reviews";
import { REVIEW_STATUSES } from "@/lib/validation/review";
import { ReviewFilters } from "./review-filters";
import { ReviewList } from "./review-list";

export const metadata: Metadata = { title: "Reviews" };

const filtersSchema = z.object({
  status: z.enum(REVIEW_STATUSES).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  rating: z.coerce.number().int().min(1).max(5).optional().catch(undefined),
  media: z.literal("with").optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  await requireAdminView();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const filters = filtersSchema.parse({
    status: one(sp.status),
    q: one(sp.q),
    rating: one(sp.rating),
    media: one(sp.media),
    page: one(sp.page),
  });

  const { rows, total, page, pages, pending, published } = await listReviewsForAdmin(filters);
  const filtered = !!(filters.status || filters.q || filters.rating || filters.media);

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, page: p > 1 ? p : undefined })) if (v) params.set(k, String(v));
    const qs = params.toString();
    return `/admin/reviews${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Reviews"
        description={pending ? `${pending} waiting for approval · ${published} published` : `${published} published`}
      />
      <ReviewFilters
        initial={{ status: filters.status, q: filters.q, rating: filters.rating, media: filters.media }}
        pending={pending}
        published={published}
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-600 py-16 text-center">
          <p className="text-sm text-stone">
            {filters.status === "pending" && !filters.q && !filters.rating && !filters.media
              ? "No reviews waiting for approval."
              : filtered
                ? "No reviews match these filters."
                : "No reviews yet. Customers' reviews from product pages will appear here for approval."}
          </p>
        </div>
      ) : (
        <>
          {filtered && <p className="mb-2 text-xs text-mute">{total} matching</p>}
          <ReviewList key={rows.map((r) => r.id + r.isApproved + r.isPinned).join()} initial={rows} />
        </>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="rounded-md border border-ink-600 px-3 py-1.5 text-stone hover:border-gold-500/40 hover:text-gold-300">
              ← Previous
            </Link>
          ) : null}
          <span className="text-mute">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className="rounded-md border border-ink-600 px-3 py-1.5 text-stone hover:border-gold-500/40 hover:text-gold-300">
              Next →
            </Link>
          ) : null}
        </nav>
      )}
    </>
  );
}
