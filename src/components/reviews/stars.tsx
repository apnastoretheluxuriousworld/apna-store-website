import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only 5-star row. Half stars are rounded to the nearest whole star. */
export function Stars({ rating, className, size = "size-3.5" }: { rating: number; className?: string; size?: string }) {
  const filled = Math.round(rating);
  return (
    <span role="img" aria-label={`Rated ${rating} out of 5`} className={cn("inline-flex gap-0.5 text-gold-400", className)}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={size} fill={i < filled ? "currentColor" : "none"} strokeWidth={1.25} aria-hidden />
      ))}
    </span>
  );
}
