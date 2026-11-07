import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Diamond "AS" emblem only. Source image is 590×444. */
export function Emblem({
  className,
  priority,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/logo-emblem.png"
      alt="Apna Store emblem"
      width={590}
      height={444}
      priority={priority}
      className={cn("h-auto w-auto", className)}
    />
  );
}

/** Emblem + wordmark, linked home. */
export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="Apna Store — home"
      className={cn("flex items-center gap-3", className)}
    >
      <Emblem priority className={compact ? "h-7" : "h-9"} />
      <span className="h-7 w-px bg-gold-500/60" aria-hidden />
      <Image
        src="/brand/logo-wordmark.png"
        alt="Apna Store — The Luxurious World"
        width={1284}
        height={248}
        priority
        className={cn("w-auto", compact ? "h-6" : "h-8")}
      />
    </Link>
  );
}
