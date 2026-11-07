"use client";

import { useState } from "react";
import { MediaLightbox, MediaThumb } from "@/components/reviews/media-viewer";
import type { ReviewMedia } from "@/lib/db/schema";

/** Testimonial photo/video on its card; tap to view full screen (videos play there). */
export function TestimonialMedia({ media, name }: { media: ReviewMedia; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${media.type === "video" ? "Play video" : "View photo"} from ${name}`}
        className="group/m block w-full overflow-hidden rounded-lg ring-gold-400/60 focus-visible:ring-2 focus-visible:outline-none"
      >
        <MediaThumb
          item={media}
          sizes="(min-width: 1024px) 30vw, 80vw"
          className="aspect-4/5 w-full transition-transform duration-700 ease-luxe group-hover/m:scale-[1.03]"
        />
      </button>
      {open && <MediaLightbox media={[media]} start={0} onClose={() => setOpen(false)} />}
    </>
  );
}
