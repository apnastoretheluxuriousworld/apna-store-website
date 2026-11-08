"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { refreshStorageUsage } from "@/app/admin/(panel)/storage-actions";
import { cn } from "@/lib/utils";

export function RefreshStorageButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => refreshStorageUsage())}
      disabled={pending}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-600 px-2.5 text-xs text-stone hover:border-gold-500/40 hover:text-ivory disabled:opacity-60"
    >
      <RefreshCw className={cn("size-3.5", pending && "animate-spin")} strokeWidth={1.5} />
      {pending ? "Checking…" : "Refresh"}
    </button>
  );
}
