"use client";

import { useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";
import { signOutCustomer } from "@/app/(store)/account/actions";

export function CustomerSignOutButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => signOutCustomer())}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md border border-ink-600 px-3 py-2 text-xs uppercase tracking-[0.16em] text-stone transition-colors hover:border-gold-500/40 hover:text-gold-300 disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
      Sign out
    </button>
  );
}
