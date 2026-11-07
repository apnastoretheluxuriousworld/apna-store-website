"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** 1–5 star input (radio group). */
export function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  return (
    <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          className="grid size-10 place-items-center rounded-lg hover:bg-ink-800"
        >
          <Star className={cn("size-6", n <= shown ? "fill-gold-400 text-gold-400" : "text-ink-600")} strokeWidth={1.25} />
        </button>
      ))}
      <span className="ml-2 text-sm tabular-nums text-stone">{value} / 5</span>
    </div>
  );
}
