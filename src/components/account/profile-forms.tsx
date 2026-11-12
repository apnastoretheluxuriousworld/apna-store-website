"use client";

import { useActionState } from "react";
import { Check, Loader2 } from "lucide-react";
import { changePin, updateName, type FormState } from "@/app/(store)/account/actions";
import { Button } from "@/components/ui/button";
import { FormError, NameField, PinField } from "./fields";

function Saved({ show, text }: { show: boolean; text: string }) {
  if (!show) return null;
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
      <Check className="size-3.5" /> {text}
    </span>
  );
}

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateName, {});
  return (
    <form action={action} noValidate>
      <NameField key={state.values?.name ?? name} defaultValue={state.values?.name ?? name} error={state.fieldErrors?.name} />
      <FormError message={pending ? undefined : state.error} />
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          Save name
        </Button>
        {/* Optimistic: "Saved" shows on tap; if the server refuses, it goes and the error shows instead. */}
        <Saved show={pending || !!state.ok} text="Saved" />
      </div>
    </form>
  );
}

export function ChangePinForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePin, {});
  // React resets the form after each submit, so the PIN boxes clear by themselves.
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      <PinField name="current" label="Current PIN" autoComplete="current-password" error={fe.current} />
      <div className="grid gap-4 sm:grid-cols-2">
        <PinField name="pin" label="New PIN" autoComplete="new-password" error={fe.pin} />
        <PinField name="confirmPin" label="Confirm new PIN" autoComplete="new-password" error={fe.confirmPin} />
      </div>
      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Update PIN"}
        </Button>
        <Saved show={!!state.ok && !pending} text="PIN updated" />
      </div>
    </form>
  );
}
