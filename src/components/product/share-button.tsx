"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Share this product. Phones open their own share sheet (WhatsApp, Instagram…);
 * browsers without one (most desktops) copy the link instead.
 */
export function ShareButton({ name, className }: { name: string; className?: string }) {
  async function share() {
    const url = window.location.href.split("#")[0];
    const title = `${name} · Apna Store`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `Have a look at ${name} on Apna Store`, url });
      } catch {
        /* closed the share sheet */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", { description: "Paste it anywhere to share this product." });
    } catch {
      toast.error("Couldn't copy the link", { description: url });
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={`Share ${name}`}
      title="Share"
      className={cn(
        "grid size-10 place-items-center rounded-full border border-gold-500/30 bg-ink-950/75 text-gold-300 backdrop-blur-sm transition-colors hover:border-gold-400/70 hover:text-gold-200 active:scale-95",
        className,
      )}
    >
      <Share2 className="size-4.5" strokeWidth={1.6} />
    </button>
  );
}
