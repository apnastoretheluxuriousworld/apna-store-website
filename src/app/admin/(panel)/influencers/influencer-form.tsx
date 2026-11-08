"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card } from "@/components/admin/ui";
import { ConfirmDialog, Field, FormActions, Switch, inputClass } from "@/components/admin/form";
import { enqueue, pendingSave } from "@/components/admin/outbox";
import { influencerInputSchema } from "@/lib/validation/coupon";
import { cn } from "@/lib/utils";

export type InfluencerFormValues = {
  name: string;
  handle: string;
  phone: string;
  commissionPercent: string;
  notes: string;
  isActive: boolean;
};

const EMPTY: InfluencerFormValues = { name: "", handle: "", phone: "", commissionPercent: "", notes: "", isActive: true };

const resolver = zodResolver(influencerInputSchema.omit({ id: true })) as unknown as Resolver<InfluencerFormValues>;

export function InfluencerForm({ initial, orders = 0 }: { initial?: InfluencerFormValues & { id: string }; orders?: number }) {
  const router = useRouter();
  const editing = !!initial;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<InfluencerFormValues>({ resolver, defaultValues: initial ?? EMPTY });
  const { register, control, handleSubmit, formState } = form;
  const errors = formState.errors;

  useEffect(() => {
    if (!initial || form.formState.isDirty) return;
    const queued = pendingSave(initial.id)?.formValues as InfluencerFormValues | undefined;
    form.reset(queued ?? initial);
  }, [initial, form]);
  const showActions = !editing || formState.isDirty;

  // Validated by the resolver; the raw form strings are what's queued (the server parses them again).
  function save() {
    const values = form.getValues();
    const id = initial?.id ?? crypto.randomUUID();
    const payload = { ...values, id };
    enqueue({
      kind: "influencer.save",
      entityId: id,
      label: values.name,
      payload,
      formValues: values,
      editHref: `/admin/influencers/${id}`,
      preview: {
        id,
        name: values.name.trim(),
        handle: values.handle.trim().replace(/^@+/, ""),
        phone: values.phone,
        commissionPercent: Number(values.commissionPercent) || 0,
        notes: values.notes,
        isActive: values.isActive,
      },
    });
    toast.success(editing ? "Saved" : `${values.name.trim()} added — open them to create their coupon`);
    form.reset(values);
    router.push("/admin/influencers");
  }
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => void handleSubmit(save)(e);

  function onDelete() {
    if (!initial) return;
    enqueue({ kind: "influencer.delete", entityId: initial.id, label: initial.name, payload: initial.id });
    toast.success("Influencer deleted");
    router.push("/admin/influencers");
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cn("space-y-3 lg:space-y-5 lg:pb-0", showActions && "pb-20")}>
      <Card className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name?.message} htmlFor="name">
            <input id="name" maxLength={60} className={inputClass} placeholder="Riya Sharma" aria-invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field label="Instagram handle" error={errors.handle?.message} hint="Optional" htmlFor="handle">
            <span className="relative block">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-mute">@</span>
              <input
                id="handle"
                maxLength={60}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                className={cn(inputClass, "pl-8")}
                placeholder="riya.styles"
                aria-invalid={!!errors.handle}
                {...register("handle")}
              />
            </span>
          </Field>
          <Field label="Mobile" error={errors.phone?.message} hint="Optional · for paying them / WhatsApp" htmlFor="phone">
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              maxLength={14}
              className={inputClass}
              placeholder="9876543210"
              aria-invalid={!!errors.phone}
              {...register("phone")}
            />
          </Field>
          <Field
            label="Commission"
            error={errors.commissionPercent?.message}
            hint="% of each delivered order with their code (after the discount, before shipping) · blank = none"
            htmlFor="commissionPercent"
          >
            <span className="relative block">
              <input
                id="commissionPercent"
                type="number"
                inputMode="numeric"
                min={0}
                max={50}
                className={inputClass}
                placeholder="0"
                aria-invalid={!!errors.commissionPercent}
                {...register("commissionPercent")}
              />
              <span className="pointer-events-none absolute top-1/2 right-9 -translate-y-1/2 text-sm text-mute">%</span>
            </span>
          </Field>
        </div>
        <Field label="Notes" error={errors.notes?.message} hint="Only you see this · deal, UPI ID for payouts…" htmlFor="notes">
          <textarea
            id="notes"
            rows={3}
            maxLength={500}
            className={cn(inputClass, "h-auto py-3 leading-relaxed")}
            placeholder="2 reels + 3 stories for Diwali. Pays to riya@okaxis."
            {...register("notes")}
          />
        </Field>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-600/70 px-3.5 py-3">
          <div>
            <p className="text-sm text-ivory">Active</p>
            <p className="text-xs text-mute">Switching off stops all their coupon codes at checkout.</p>
          </div>
          <Controller control={control} name="isActive" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Active" />} />
        </div>
      </Card>

      {editing && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-red-500/20">
          <div>
            <p className="text-sm text-ivory">Delete influencer</p>
            <p className="text-xs text-mute">
              {orders ? "They have orders, so they can't be deleted. Switch them off instead." : "Their coupons stay, as store coupons."}
            </p>
          </div>
          <button
            type="button"
            disabled={orders > 0}
            onClick={() => setConfirmDelete(true)}
            className="h-10 rounded-lg border border-red-500/40 px-4 text-sm text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete
          </button>
        </Card>
      )}

      {showActions && <FormActions cancelHref="/admin/influencers" saving={false} label={editing ? "Save changes" : "Add influencer"} />}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this influencer?"
        body={<>“{initial?.name}” will be removed. Their coupon codes keep working as store coupons.</>}
        pending={false}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}
