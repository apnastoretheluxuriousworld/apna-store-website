"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { signIn, signUp, type FormState } from "@/app/(store)/account/actions";
import { Button } from "@/components/ui/button";
import { requestPinReset, type ForgotPinState } from "@/app/(store)/account/forgot-pin-actions";
import { formatPhone } from "@/lib/validation/customer";
import { FormError, NameField, PhoneField, PinField, storeInputClass } from "./fields";

function useNext() {
  return useSearchParams().get("next") ?? "";
}

export function SignInForm() {
  const [forgot, setForgot] = useState<{ phone: string } | null>(null);
  if (forgot) return <ForgotPinForm phone={forgot.phone} onBack={() => setForgot(null)} />;
  return <SignInFields onForgot={(phone) => setForgot({ phone })} />;
}

function SignInFields({ onForgot }: { onForgot: (phone: string) => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  const next = useNext();
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <PhoneField defaultValue={state.values?.phone} error={fe.phone} autoFocus />
      <PinField
        name="pin"
        label="4-digit PIN"
        autoComplete="current-password"
        error={fe.pin}
        hint={
          <button
            type="button"
            // Carry over whatever number is already typed.
            onClick={(e) => onForgot((e.currentTarget.form?.elements.namedItem("phone") as HTMLInputElement | null)?.value ?? "")}
            className="text-gold-400/90 hover:text-gold-300"
          >
            Forgot your PIN? Ask the store to reset it.
          </button>
        }
      />
      <FormError message={state.error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
      </Button>
    </form>
  );
}

/** Sends a "please reset my PIN" message to the store (Admin → Feedback + a notification). */
function ForgotPinForm({ phone, onBack }: { phone: string; onBack: () => void }) {
  const [state, action, pending] = useActionState<ForgotPinState, FormData>(requestPinReset, { phone });
  // Errors belong to the last attempt: typing again clears them.
  const [editedAfter, setEditedAfter] = useState<ForgotPinState | null>(null);
  const showErrors = editedAfter !== state;

  if (state.ok) {
    return (
      <div className="space-y-5 text-center">
        <CheckCircle2 className="mx-auto size-10 text-gold-400" strokeWidth={1.25} />
        <div>
          <p className="font-serif text-2xl text-ivory">Request sent</p>
          <p className="mt-2 text-sm leading-relaxed text-stone">
            If +91 {formatPhone(state.phone)} has an account, the store will reset your PIN and share the new one with you on that number.
          </p>
        </div>
        <Button type="button" variant="outline" size="lg" className="w-full" onClick={onBack}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form action={action} onInput={() => setEditedAfter(state)} className="space-y-4" noValidate>
      <p className="text-sm leading-relaxed text-stone">
        Enter your mobile number and we&apos;ll ask the store to reset your PIN. They&apos;ll contact you with a new one.
      </p>
      <PhoneField defaultValue={state.phone} error={showErrors ? state.phoneError : undefined} autoFocus />
      <div>
        <label htmlFor="note" className="mb-1.5 block text-[0.65rem] uppercase tracking-[0.2em] text-stone">
          Message <span className="normal-case tracking-normal text-mute">(optional)</span>
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={300}
          defaultValue={state.note}
          placeholder="e.g. Please call me after 6 pm"
          className={`${storeInputClass} h-auto resize-none px-4 py-3`}
        />
      </div>
      <FormError message={showErrors ? state.error : undefined} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Send reset request"}
      </Button>
      <button type="button" onClick={onBack} className="block w-full text-center text-xs text-stone hover:text-gold-300">
        ← Back to sign in
      </button>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, {});
  const next = useNext();
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <NameField defaultValue={state.values?.name} error={fe.name} />
      <PhoneField defaultValue={state.values?.phone} error={fe.phone} />
      <PinField name="pin" label="Create a 4-digit PIN" autoComplete="new-password" error={fe.pin} hint="You'll use this PIN to sign in." />
      <PinField name="confirmPin" label="Confirm PIN" autoComplete="new-password" error={fe.confirmPin} />
      <FormError message={state.error} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
      </Button>
      <p className="text-center text-[0.7rem] leading-relaxed text-mute">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="underline decoration-ink-600 underline-offset-2 hover:text-gold-300">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline decoration-ink-600 underline-offset-2 hover:text-gold-300">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}

/** Keeps ?next= when switching between sign-in and sign-up. */
export function SwitchAuthLink({ to, children }: { to: "/account/login" | "/account/signup"; children: React.ReactNode }) {
  const next = useNext();
  return (
    <Link href={next ? `${to}?next=${encodeURIComponent(next)}` : to} className="font-medium text-gold-400 hover:text-gold-300">
      {children}
    </Link>
  );
}
