"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card } from "@/components/admin/ui";
import { ConfirmDialog, Field, FormActions, Switch, inputClass, selectClass } from "@/components/admin/form";
import { ImageUpload } from "@/components/admin/image-upload";
import { enqueue, pendingSave } from "@/components/admin/outbox";
import { HERO_LIMITS, heroSlideFormSchema } from "@/lib/validation/hero";
import { cn } from "@/lib/utils";

export type HeroSlideFormValues = {
  imageUrl: string;
  eyebrow: string;
  title: string;
  highlight: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  isActive: boolean;
};

const resolver = zodResolver(heroSlideFormSchema) as unknown as Resolver<HeroSlideFormValues>;

const EMPTY: HeroSlideFormValues = {
  imageUrl: "",
  eyebrow: "",
  title: "",
  highlight: "",
  subtitle: "",
  ctaLabel: "Shop now",
  ctaHref: "/shop",
  isActive: true,
};

const CUSTOM = "__custom";

export function HeroSlideForm({
  initial,
  categories,
}: {
  initial?: HeroSlideFormValues & { id: string };
  categories: { name: string; slug: string }[];
}) {
  const router = useRouter();
  const editing = !!initial;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<HeroSlideFormValues>({ resolver, defaultValues: initial ?? EMPTY });
  const { register, control, handleSubmit, setValue, formState } = form;
  const errors = formState.errors;
  const v = useWatch({ control }) as HeroSlideFormValues;

  // Fresh server data (or a still-queued save, which is newer) — never over unsaved edits.
  useEffect(() => {
    if (!initial || form.formState.isDirty) return;
    const queued = pendingSave(initial.id)?.formValues as HeroSlideFormValues | undefined;
    form.reset(queued ?? initial);
  }, [initial, form]);
  const showActions = !editing || formState.isDirty;

  // Button destination: none, all collections, one collection, or a typed link.
  const presets = ["", "/shop", ...categories.map((c) => `/shop/${c.slug}`)];
  const [customLink, setCustomLink] = useState(() => !presets.includes(initial?.ctaHref ?? EMPTY.ctaHref));
  const linkChoice = customLink ? CUSTOM : v.ctaHref;

  function save(values: HeroSlideFormValues) {
    const id = initial?.id ?? crypto.randomUUID();
    const payload = { ...values, id };
    enqueue({
      kind: "hero.save",
      entityId: id,
      label: [values.title, values.highlight].filter(Boolean).join(" ") || "Hero banner",
      payload,
      formValues: values,
      editHref: `/admin/hero/${id}`,
      preview: payload,
    });
    toast.success(editing ? "Banner saved" : "Banner added");
    form.reset(values);
    router.push("/admin/hero");
  }
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => void handleSubmit(save)(e);

  function onDelete() {
    if (!initial) return;
    enqueue({ kind: "hero.delete", entityId: initial.id, label: initial.title || initial.highlight || "Hero banner", payload: initial.id });
    toast.success("Banner deleted");
    router.push("/admin/hero");
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cn("space-y-3 lg:space-y-5 lg:pb-0", showActions && "pb-20")}>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-5">
        {/* Image + live preview */}
        <div className="space-y-3 lg:space-y-5">
          <Card>
            <Field label="Image" error={errors.imageUrl?.message} hint="Use a square image, 1200×1200 (1:1). Keep the product in the centre on a dark background and put no text in the image, since the edges get cropped and the bottom fades into black.">
              <Controller
                control={control}
                name="imageUrl"
                render={({ field }) => (
                  <ImageUpload folder="hero" value={field.value || null} onChange={(url) => field.onChange(url ?? "")} />
                )}
              />
            </Field>
          </Card>
          <Card>
            <p className="mb-3 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Preview</p>
            <Preview v={v} />
          </Card>
        </div>

        <div className="space-y-3 lg:space-y-5">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ivory">Show on homepage</p>
                <p className="text-xs text-mute">Hidden banners are kept for later.</p>
              </div>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Show on homepage" />}
              />
            </div>
          </Card>

          <Card className="space-y-4">
            <Field label="Small line on top" error={errors.eyebrow?.message} hint="Optional · e.g. Festive offer, New arrival" htmlFor="eyebrow">
              <input id="eyebrow" maxLength={HERO_LIMITS.eyebrow} className={inputClass} placeholder="Diwali Offer" {...register("eyebrow")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Headline" error={errors.title?.message} htmlFor="title">
                <input id="title" maxLength={HERO_LIMITS.title} className={inputClass} placeholder="Flat 20% off" aria-invalid={!!errors.title} {...register("title")} />
              </Field>
              <Field label="Gold line" error={errors.highlight?.message} hint="Optional · shown in gold italics below" htmlFor="highlight">
                <input id="highlight" maxLength={HERO_LIMITS.highlight} className={inputClass} placeholder="on Timepieces." {...register("highlight")} />
              </Field>
            </div>
            <Field label="Text" error={errors.subtitle?.message} hint="Optional" htmlFor="subtitle">
              <textarea
                id="subtitle"
                rows={2}
                maxLength={HERO_LIMITS.subtitle}
                className={cn(inputClass, "h-auto py-3 leading-relaxed")}
                placeholder="This week only, on every watch in the store."
                {...register("subtitle")}
              />
            </Field>
          </Card>

          <Card className="space-y-4">
            <Field label="Button goes to" error={errors.ctaHref?.message} htmlFor="ctaChoice">
              <select
                id="ctaChoice"
                className={selectClass}
                value={linkChoice}
                onChange={(e) => {
                  const next = e.target.value;
                  setCustomLink(next === CUSTOM);
                  if (next !== CUSTOM) setValue("ctaHref", next, { shouldDirty: true, shouldValidate: true });
                }}
              >
                <option value="">No button</option>
                <option value="/shop">All collections</option>
                {categories.map((c) => (
                  <option key={c.slug} value={`/shop/${c.slug}`}>
                    {c.name}
                  </option>
                ))}
                <option value={CUSTOM}>Other link…</option>
              </select>
            </Field>
            {customLink && (
              <Field label="Link" hint="A page on this site like /shop/watches, or a full https:// link" htmlFor="ctaHref">
                <input id="ctaHref" className={inputClass} placeholder="/shop/watches" aria-invalid={!!errors.ctaHref} {...register("ctaHref")} />
              </Field>
            )}
            {(v.ctaHref || customLink) && (
              <Field label="Button text" error={errors.ctaLabel?.message} htmlFor="ctaLabel">
                <input id="ctaLabel" maxLength={HERO_LIMITS.ctaLabel} className={inputClass} placeholder="Shop now" {...register("ctaLabel")} />
              </Field>
            )}
          </Card>

          {editing && (
            <Card className="flex flex-wrap items-center justify-between gap-3 border-red-500/20">
              <p className="text-sm text-ivory">Delete banner</p>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="h-10 rounded-lg border border-red-500/40 px-4 text-sm text-red-300 hover:bg-red-500/10"
              >
                Delete
              </button>
            </Card>
          )}
        </div>
      </div>

      {showActions && <FormActions cancelHref="/admin/hero" saving={false} label={editing ? "Save changes" : "Add banner"} />}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this banner?"
        body="It's removed from the homepage and can't be restored."
        pending={false}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}

/** Rough phone-sized look of the slide on the homepage. */
function Preview({ v }: { v: HeroSlideFormValues }) {
  return (
    <div className="relative mx-auto aspect-9/16 w-full max-w-64 overflow-hidden rounded-xl bg-ink-950">
      <div className="absolute top-[18%] left-1/2 size-[140%] -translate-x-1/2 -translate-y-1/4 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.22),transparent_60%)]" />
      {v.imageUrl && (
        <div className="absolute inset-x-0 top-[8%] bottom-[26%] mask-[linear-gradient(to_bottom,black_75%,transparent)]">
          <Image src={v.imageUrl} alt="" fill unoptimized className="object-cover" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-ink-950 via-ink-950/85 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-4 pb-6 text-center">
        {v.eyebrow && <p className="eyebrow mb-2 text-[0.5rem]">{v.eyebrow}</p>}
        <p className="font-serif text-xl leading-tight font-light text-ivory">
          {v.title}
          {v.title && v.highlight && <br />}
          {v.highlight && <em className="text-gold font-normal">{v.highlight}</em>}
          {!v.title && !v.highlight && <span className="text-mute">Your headline</span>}
        </p>
        {v.subtitle && <p className="mt-2 line-clamp-3 text-[0.6rem] leading-relaxed text-stone">{v.subtitle}</p>}
        {v.ctaHref && (
          <span className="mt-3 rounded bg-gold px-3 py-1.5 text-[0.5rem] font-semibold tracking-[0.2em] text-ink-950 uppercase">
            {v.ctaLabel || "Shop now"}
          </span>
        )}
      </div>
    </div>
  );
}
