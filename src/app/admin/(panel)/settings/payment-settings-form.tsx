"use client";

import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card } from "@/components/admin/ui";
import { Field, FormActions, Switch, inputClass } from "@/components/admin/form";
import { ImageUpload } from "@/components/admin/image-upload";
import { enqueue, pendingSave } from "@/components/admin/outbox";
import { paymentSettingsSchema, type PaymentSettings } from "@/lib/validation/checkout";
import { cn, trimLeadingZeros } from "@/lib/utils";

const resolver = zodResolver(paymentSettingsSchema) as unknown as Resolver<PaymentSettings>;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">{title}</h2>
        {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

function RupeeInput({ id, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { id: string }) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-mute">₹</span>
      <input id={id} type="number" inputMode="numeric" min={0} step={1} onInput={trimLeadingZeros} className={cn(inputClass, "pl-7")} {...props} />
    </span>
  );
}

export function PaymentSettingsForm({ initial }: { initial: PaymentSettings }) {
  const form = useForm<PaymentSettings>({ resolver, defaultValues: initial });
  const { register, handleSubmit, formState, watch, setValue } = form;
  const errors = formState.errors;

  useEffect(() => {
    if (form.formState.isDirty) return;
    const queued = pendingSave("payments")?.formValues as PaymentSettings | undefined;
    form.reset(queued ?? initial);
  }, [initial, form]);

  function save(values: PaymentSettings) {
    enqueue({
      kind: "settings.payments",
      entityId: "payments",
      label: "Payment settings",
      payload: values,
      formValues: values,
      editHref: "/admin/settings",
    });
    toast.success("Payment settings saved");
    form.reset(values);
  }

  const qrUrl = watch("qrUrl");
  const codEnabled = watch("codEnabled");
  const num = { valueAsNumber: true } as const;

  return (
    <form onSubmit={(e) => void handleSubmit(save)(e)} noValidate className={cn("space-y-3 lg:space-y-5", formState.isDirty && "pb-20 lg:pb-0")}>
      <div className="grid gap-3 lg:grid-cols-2 lg:gap-5">
        <Section
          title="UPI payment (scan & pay)"
          hint="Customers scan this QR, pay from their phone and upload a screenshot. You approve the payment on the order. Remove the QR to turn UPI off."
        >
          <div className="grid gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
            <ImageUpload
              value={qrUrl || null}
              onChange={(url) => setValue("qrUrl", url ?? "", { shouldDirty: true, shouldValidate: true })}
              folder="payments"
              aspect="aspect-square"
              label="UPI QR code"
            />
            <div className="space-y-4">
              {errors.qrUrl?.message && <p className="text-xs text-red-400">{errors.qrUrl.message}</p>}
              <Field label="UPI ID" error={errors.upiId?.message} hint="Optional · lets customers copy it or open their UPI app with the amount filled in" htmlFor="upiId">
                <input id="upiId" className={inputClass} placeholder="apnastore@okaxis" autoCapitalize="off" spellCheck={false} {...register("upiId")} />
              </Field>
              <Field label="Name on the account" error={errors.payeeName?.message} hint="Optional · shown next to the QR" htmlFor="payeeName">
                <input id="payeeName" className={inputClass} placeholder="Apna Store" {...register("payeeName")} />
              </Field>
            </div>
          </div>
        </Section>

        <div className="space-y-3 lg:space-y-5">
          <Section title="Cash on delivery" hint="Customers must confirm they'll pay cash when the order arrives.">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-ivory">Offer cash on delivery</span>
              <Switch checked={codEnabled} onChange={(v) => setValue("codEnabled", v, { shouldDirty: true })} label="Offer cash on delivery" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Minimum order for COD" error={errors.codMinOrder?.message} hint="0 = any amount" htmlFor="codMinOrder">
                <RupeeInput id="codMinOrder" disabled={!codEnabled} {...register("codMinOrder", num)} />
              </Field>
              <Field label="COD charge" error={errors.codFee?.message} hint="Added to the total when the customer picks COD · 0 = none" htmlFor="codFee">
                <RupeeInput id="codFee" disabled={!codEnabled} {...register("codFee", num)} />
              </Field>
            </div>
          </Section>

          <Section title="Returns" hint="Shown to the customer at checkout and saved on the order. It isn't added to the order total.">
            <Field label="Return charge" error={errors.returnFee?.message} hint="0 = don't show a return charge" htmlFor="returnFee">
              <RupeeInput id="returnFee" {...register("returnFee", num)} />
            </Field>
          </Section>

          <Section title="Shipping">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Shipping fee" error={errors.shippingFee?.message} hint="0 = always free" htmlFor="shippingFee">
                <RupeeInput id="shippingFee" {...register("shippingFee", num)} />
              </Field>
              <Field label="Free shipping from" error={errors.freeShippingAbove?.message} hint="Cart total · 0 = never free" htmlFor="freeShippingAbove">
                <RupeeInput id="freeShippingAbove" {...register("freeShippingAbove", num)} />
              </Field>
            </div>
          </Section>
        </div>
      </div>

      {formState.isDirty && <FormActions cancelHref="/admin/settings" saving={false} label="Save changes" />}
    </form>
  );
}
