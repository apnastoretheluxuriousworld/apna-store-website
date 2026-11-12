"use client";

import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card } from "@/components/admin/ui";
import { Field, FormActions, inputClass } from "@/components/admin/form";
import { enqueue, pendingSave } from "@/components/admin/outbox";
import { storeInfoSchema, type StoreInfoValues } from "@/lib/validation/settings";
import { cn } from "@/lib/utils";

const resolver = zodResolver(storeInfoSchema) as unknown as Resolver<StoreInfoValues>;

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

export function StoreInfoForm({ initial }: { initial: StoreInfoValues }) {
  const form = useForm<StoreInfoValues>({ resolver, defaultValues: initial });
  const { register, handleSubmit, formState } = form;
  const errors = formState.errors;

  // Fresh server data (or a still-queued save, which is newer) — never over unsaved edits.
  useEffect(() => {
    if (form.formState.isDirty) return;
    const queued = pendingSave("store")?.formValues as StoreInfoValues | undefined;
    form.reset(queued ?? initial);
  }, [initial, form]);

  function save(values: StoreInfoValues) {
    enqueue({
      kind: "settings.store",
      entityId: "store",
      label: "Store details",
      payload: values,
      formValues: values,
      editHref: "/admin/settings",
    });
    toast.success("Store details saved");
    form.reset(values);
  }
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => void handleSubmit(save)(e);

  return (
    <form onSubmit={onSubmit} noValidate className={cn("space-y-3 lg:space-y-5", formState.isDirty && "pb-20 lg:pb-0")}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-5">
        <Section title="Phone & email" hint="Shown in the footer and on the Contact page. Leave blank to hide.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" error={errors.phone?.message} htmlFor="phone">
              <input id="phone" type="tel" className={inputClass} placeholder="+91 96663 51344" {...register("phone")} />
            </Field>
            <Field label="Second phone" error={errors.phone2?.message} hint="Optional" htmlFor="phone2">
              <input id="phone2" type="tel" className={inputClass} placeholder="+91 95737 67831" {...register("phone2")} />
            </Field>
          </div>
          <Field label="Email" error={errors.email?.message} hint="Optional" htmlFor="email">
            <input id="email" type="email" className={inputClass} placeholder="hello@apnastore.in" {...register("email")} />
          </Field>
        </Section>

        <Section title="Social" hint="Each icon appears in the footer only when its link is filled in.">
          <Field label="Instagram link" error={errors.instagram?.message} htmlFor="instagram">
            <input id="instagram" className={inputClass} placeholder="https://www.instagram.com/apna_store_1" {...register("instagram")} />
          </Field>
          <Field label="YouTube link" error={errors.youtube?.message} htmlFor="youtube">
            <input id="youtube" className={inputClass} placeholder="https://www.youtube.com/@apnastore" {...register("youtube")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WhatsApp number" error={errors.whatsapp?.message} hint="For “Chat on WhatsApp”" htmlFor="whatsapp">
              <input id="whatsapp" type="tel" className={inputClass} placeholder="91 96663 51344" {...register("whatsapp")} />
            </Field>
            <Field label="WhatsApp group link" error={errors.whatsappGroup?.message} hint="Optional · used instead of the chat if set" htmlFor="whatsappGroup">
              <input id="whatsappGroup" className={inputClass} placeholder="https://chat.whatsapp.com/…" {...register("whatsappGroup")} />
            </Field>
          </div>
        </Section>

        <Section title="Store address" hint="One line per row. The footer shows the first two lines; tapping it opens Google Maps.">
          <Field label="Address" error={errors.address?.message} htmlFor="address">
            <textarea id="address" rows={3} className={cn(inputClass, "h-auto py-3 leading-relaxed")} {...register("address")} />
          </Field>
        </Section>
      </div>

      {formState.isDirty && <FormActions cancelHref="/admin/settings" saving={false} label="Save changes" />}
    </form>
  );
}
