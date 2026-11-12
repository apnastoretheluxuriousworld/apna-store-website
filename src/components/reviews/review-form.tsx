"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CircleCheck, Loader2, Star } from "lucide-react";
import { submitReview } from "@/app/(store)/account/reviews/actions";
import { storeInputClass } from "@/components/account/fields";
import { Button, buttonClass } from "@/components/ui/button";
import type { ReviewMedia } from "@/lib/db/schema";
import { CUSTOMER_REVIEW_LIMITS } from "@/lib/validation/review";
import { cn } from "@/lib/utils";
import { SIGNED_OUT_ERROR, goToSignIn } from "@/lib/auth/signed-out";
import { ReviewMediaPicker } from "./review-media-picker";

const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

export type ReviewFormInitial = { rating: number; body: string | null; media: ReviewMedia[] } | null;

/** Write or edit the signed-in customer's review of one product. */
export function ReviewForm({ productId, initial }: { productId: string; initial: ReviewFormInitial }) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState<number | null>(null);
  const [body, setBody] = useState(initial?.body ?? "");
  const [media, setMedia] = useState<ReviewMedia[]>(initial?.media ?? []);
  const [error, setError] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (done) {
    return (
      <div className="rounded-2xl border border-gold-500/25 bg-ink-850 px-5 py-10 text-center">
        <CircleCheck className="mx-auto size-10 text-gold-400" strokeWidth={1.25} />
        <p className="mt-4 font-serif text-3xl font-light text-ivory">Thank you!</p>
        <p className="mt-2 text-sm text-stone">Thank you for your review.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/account" className={buttonClass("outline", "md")}>
            My orders
          </Link>
          <Link href="/shop" className={buttonClass("gold", "md")}>
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!rating) {
      setRatingError("Please choose a star rating");
      return;
    }
    // Optimistic: show "Thank you" at once and save in the background. If the
    // save fails, the form comes back with the customer's text and the reason.
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    const failed = (message: string, ratingMessage?: string) => {
      setDone(false);
      setError(message);
      if (ratingMessage) setRatingError(ratingMessage);
      // Also a toast, in case they already moved on to another page.
      toast.error("Your review wasn't saved", { description: message });
    };
    submitReview({ productId, rating, body, media })
      .then((res) => {
        if (res.ok) return;
        if (res.error === SIGNED_OUT_ERROR) goToSignIn();
        else failed(res.error, res.fieldErrors?.rating);
      })
      .catch(() => failed("No connection. Please check your internet and submit again."));
  }

  const shown = hover ?? rating;

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <section className="rounded-2xl border border-ink-600/80 bg-ink-850 p-4 sm:p-5">
        <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory/80">Your rating</h2>
        <div
          role="radiogroup"
          aria-label="Rating"
          aria-describedby={ratingError ? "rating-error" : undefined}
          className="mt-3 flex items-center gap-1"
          onMouseLeave={() => setHover(null)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""} – ${RATING_WORDS[n]}`}
              onClick={() => {
                setRating(n);
                setRatingError(null);
              }}
              onMouseEnter={() => setHover(n)}
              className="grid size-11 place-items-center rounded-lg transition-transform active:scale-90"
            >
              <Star className={cn("size-8", n <= shown ? "fill-gold-400 text-gold-400" : "text-ink-600")} strokeWidth={1.1} />
            </button>
          ))}
          <span className="ml-2 text-sm text-gold-300">{RATING_WORDS[shown]}</span>
        </div>
        {ratingError && (
          <p id="rating-error" role="alert" className="mt-2 text-xs text-red-400">
            {ratingError}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-ink-600/80 bg-ink-850 p-4 sm:p-5">
        <label htmlFor="review-body" className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory/80">
          Your review <span className="normal-case tracking-normal text-mute">(optional)</span>
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={CUSTOMER_REVIEW_LIMITS.body}
          rows={4}
          placeholder="What did you like? How is the quality, the fit, the finish?"
          className={cn(storeInputClass, "mt-3 field-sizing-content h-auto max-h-80 min-h-28 px-4 py-3 leading-relaxed")}
        />
      </section>

      <section className="rounded-2xl border border-ink-600/80 bg-ink-850 p-4 sm:p-5">
        <h2 className="mb-3 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory/80">
          Photos & video <span className="normal-case tracking-normal text-mute">(optional)</span>
        </h2>
        <ReviewMediaPicker value={media} onChange={setMedia} onUploadingChange={setUploading} />
      </section>

      {error && (
        <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={uploading}>
        {uploading && <Loader2 className="size-4 animate-spin" />}
        {uploading ? "Uploading…" : initial ? "Update review" : "Submit review"}
      </Button>
    </form>
  );
}
