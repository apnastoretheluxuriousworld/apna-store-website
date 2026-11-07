"use client";

import { useFormStatus } from "react-dom";
import { Loader2, LogOut } from "lucide-react";
import { signOut } from "@/app/admin/(panel)/actions";
import { cn } from "@/lib/utils";

function Inner({ className }: { className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-stone transition-colors hover:bg-ink-800 hover:text-red-300 disabled:opacity-60",
        className,
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" strokeWidth={1.5} />}
      Sign out
    </button>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <Inner className={className} />
    </form>
  );
}
