import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function SectionHeader({
  title,
  href,
  linkLabel = "View All",
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 lg:mb-8">
      <h2 className="text-[0.8rem] font-medium uppercase tracking-[0.22em] text-ivory lg:text-sm">
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="group flex items-center gap-1 text-xs text-gold-400 transition-colors hover:text-gold-300"
        >
          {linkLabel}
          <ChevronRight
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
            strokeWidth={1.5}
          />
        </Link>
      )}
    </div>
  );
}
