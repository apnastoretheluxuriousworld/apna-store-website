import { Suspense } from "react";
import { BadgeCheck, Pin } from "lucide-react";
import { getProductReviews, type StoreReview } from "@/lib/data/reviews";
import { Stars } from "./stars";
import { ReviewMediaStrip } from "./media-viewer";
import { WriteReviewLink } from "./write-review-link";

/**
 * Storefront reviews block for a product page: rating summary, every
 * customer photo/video, then the published reviews (pinned first).
 * Cached with the "reviews" tag; admin review actions refresh it.
 *
 *   <ProductReviews productId={product.id} />
 */
export async function ProductReviews({ productId }: { productId: string }) {
  const { summary, reviews } = await getProductReviews(productId);
  const allMedia = reviews.flatMap((r) => r.media);

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-24 border-t border-ink-600/50 py-12 lg:py-16">
      <div className="mb-8 text-center lg:mb-10">
        <p className="eyebrow">Client reviews</p>
        <h2 id="reviews-title" className="mt-3 font-serif text-3xl font-light text-ivory lg:text-4xl">
          What our <em className="text-gold">clients</em> say
        </h2>
        <Suspense fallback={null}>
          <WriteReviewLink productId={productId} />
        </Suspense>
      </div>

      {summary.count === 0 ? (
        <p className="mx-auto max-w-md rounded-xl border border-dashed border-gold-500/25 py-10 text-center text-sm text-stone">
          No reviews yet for this piece.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_1fr] lg:gap-12">
          <aside className="h-fit rounded-xl border border-gold-500/15 bg-ink-800/60 p-6 lg:sticky lg:top-28">
            <div className="flex items-end gap-3">
              <span className="font-serif text-6xl leading-none font-light text-gold">{summary.average?.toFixed(1)}</span>
              <div className="pb-1">
                <Stars rating={summary.average ?? 0} />
                <p className="mt-1 text-xs text-stone">
                  {summary.count} {summary.count === 1 ? "review" : "reviews"}
                </p>
              </div>
            </div>
            <ul className="mt-5 space-y-1.5" aria-label="Rating breakdown">
              {[5, 4, 3, 2, 1].map((star) => {
                const n = summary.distribution[star - 1];
                return (
                  <li key={star} className="flex items-center gap-2 text-xs text-stone">
                    <span className="w-6 tabular-nums">{star}★</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                      <span
                        className="block h-full rounded-full bg-linear-to-r from-gold-600 to-gold-300"
                        style={{ width: `${(n / summary.count) * 100}%` }}
                      />
                    </span>
                    <span className="w-6 text-right tabular-nums text-mute">{n}</span>
                  </li>
                );
              })}
            </ul>
            {allMedia.length > 0 && (
              <div className="mt-6 border-t border-ink-600/60 pt-5">
                <p className="mb-3 text-[0.65rem] uppercase tracking-[0.2em] text-stone">Photos & videos from clients</p>
                <ReviewMediaStrip media={allMedia} label="from clients" thumbClassName="size-14 rounded-lg" />
              </div>
            )}
          </aside>

          <ul className="divide-y divide-ink-600/50">
            {reviews.map((r) => (
              <ReviewItem key={r.id} review={r} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

function ReviewItem({ review: r }: { review: StoreReview }) {
  return (
    <li className="py-6 first:pt-0">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full border border-gold-500/40 bg-ink-800 font-serif text-lg text-gold-300"
        >
          {r.authorName.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm text-ivory">{r.authorName}</p>
            {r.isVerified && (
              <span className="inline-flex items-center gap-1 text-[0.6rem] uppercase tracking-[0.15em] text-gold-400">
                <BadgeCheck className="size-3.5" strokeWidth={1.5} /> Verified buyer
              </span>
            )}
            {r.isPinned && <Pin className="size-3 text-mute" aria-label="Pinned review" />}
          </div>
          <p className="mt-0.5 text-xs text-mute">
            {r.city && <>{r.city} · </>}
            <time dateTime={r.createdAt}>{dateFmt.format(new Date(r.createdAt))}</time>
          </p>
          <Stars rating={r.rating} className="mt-2" size="size-3" />
          {r.body && <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-ivory/85">{r.body}</p>}
          {r.media.length > 0 && (
            <div className="mt-4">
              <ReviewMediaStrip media={r.media} label={`from ${r.authorName}`} />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
