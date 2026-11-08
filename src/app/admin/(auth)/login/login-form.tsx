"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole, User } from "lucide-react";
import { login, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);
  const next = useSearchParams().get("next") ?? "";

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />

      <label className="block">
        <span className="mb-1.5 block text-[0.65rem] uppercase tracking-[0.2em] text-stone">
          Username
        </span>
        <span className="relative block">
          <User className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gold-500/70" strokeWidth={1.5} />
          <input
            name="identifier"
            defaultValue={state.identifier}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            className="h-12 w-full rounded-lg border border-ink-600 bg-ink-900 pr-4 pl-10 text-sm text-ivory placeholder:text-mute focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/15 focus:outline-none"
            placeholder="Admin username"
          />
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[0.65rem] uppercase tracking-[0.2em] text-stone">Password</span>
        <span className="relative block">
          <LockKeyhole className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gold-500/70" strokeWidth={1.5} />
          <input
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="h-12 w-full rounded-lg border border-ink-600 bg-ink-900 pr-11 pl-10 text-sm text-ivory placeholder:text-mute focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/15 focus:outline-none"
            placeholder="••••••"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded text-mute hover:text-gold-400"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </span>
      </label>

      <p role="alert" aria-live="polite" className="min-h-5 text-xs text-red-400">
        {state.error}
      </p>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
      </Button>
    </form>
  );
}
