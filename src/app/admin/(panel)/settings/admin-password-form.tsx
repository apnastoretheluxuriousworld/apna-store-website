"use client";

import { useState, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Card } from "@/components/admin/ui";
import { Field, inputClass } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  changeAdminPasswordSchema,
  type ChangeAdminPasswordValues,
} from "@/lib/validation/admin-password";
import { cn } from "@/lib/utils";
import { changeAdminPassword } from "./actions";

const resolver = zodResolver(changeAdminPasswordSchema) as unknown as Resolver<ChangeAdminPasswordValues>;
const empty: ChangeAdminPasswordValues = { current: "", next: "", confirm: "" };

/**
 * Change the admin password. Unlike other admin saves this one waits for the
 * server (the current password must be checked there first).
 */
export function AdminPasswordForm({ username }: { username: string }) {
  const form = useForm<ChangeAdminPasswordValues>({ resolver, defaultValues: empty });
  const { register, handleSubmit, setError, reset, formState } = form;
  const errors = formState.errors;
  const [show, setShow] = useState(false);
  const [saving, startSaving] = useTransition();

  const save = (values: ChangeAdminPasswordValues) =>
    startSaving(async () => {
      const res = await changeAdminPassword(values);
      if (!res.ok) {
        for (const [path, message] of Object.entries(res.fieldErrors ?? {})) {
          setError(path as keyof ChangeAdminPasswordValues, { message });
        }
        toast.error(res.error);
        return;
      }
      reset(empty);
      setShow(false);
      toast.success("Password changed. Other devices have been signed out.");
    });

  const type = show ? "text" : "password";

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Admin password</h2>
        <p className="mt-1 text-xs text-mute">
          Used to sign in to this admin panel. Changing it signs you out on every other device.
        </p>
      </div>
      <form onSubmit={(e) => void handleSubmit(save)(e)} noValidate className="space-y-4">
        {/* Lets password managers save the new password under the right account. */}
        <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
        <Field label="Current password" error={errors.current?.message} htmlFor="pw-current">
          <input id="pw-current" type={type} autoComplete="current-password" className={inputClass} {...register("current")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="New password"
            error={errors.next?.message}
            hint={`At least ${ADMIN_PASSWORD_MIN_LENGTH} characters. A short phrase works well.`}
            htmlFor="pw-next"
          >
            <input id="pw-next" type={type} autoComplete="new-password" className={inputClass} {...register("next")} />
          </Field>
          <Field label="Confirm new password" error={errors.confirm?.message} htmlFor="pw-confirm">
            <input id="pw-confirm" type={type} autoComplete="new-password" className={inputClass} {...register("confirm")} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="inline-flex items-center gap-2 text-xs text-stone hover:text-gold-300"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {show ? "Hide passwords" : "Show passwords"}
          </button>
          <Button type="submit" disabled={saving} className={cn("px-5 lg:min-w-44")}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Change password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
