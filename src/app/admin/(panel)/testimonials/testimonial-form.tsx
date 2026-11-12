"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card } from "@/components/admin/ui";
import { ConfirmDialog, Field, FormActions, Switch, inputClass } from "@/components/admin/form";
import { MediaUpload } from "@/components/admin/media-upload";
import { StarPicker } from "@/components/admin/star-picker";
import type { ReviewMedia } from "@/lib/db/schema";
import { TESTIMONIAL_LIMITS, testimonialInputSchema, type TestimonialOutput } from "@/lib/validation/testimonial";
import { deleteTestimonial, saveTestimonial } from "./actions";
import { cn } from "@/lib/utils";

export type TestimonialFormValues = {
  id?: string;
  name: string;
  city: string;
  rating: number;
  body: string;
  media: ReviewMedia[];
  isActive: boolean;
};

const resolver = zodResolver(testimonialInputSchema) as unknown as Resolver<TestimonialFormValues, unknown, TestimonialOutput>;

export function TestimonialForm({ initial }: { initial?: TestimonialFormValues & { id: string } }) {
  const router = useRouter();
  const editing = !!initial;
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<TestimonialFormValues, unknown, TestimonialOutput>({
    resolver,
    defaultValues: initial ?? { name: "", city: "", rating: 5, body: "", media: [], isActive: true },
  });
  const { register, control, handleSubmit, setError, formState } = form;
  const errors = formState.errors;

  useEffect(() => {
    if (initial && !form.formState.isDirty) form.reset(initial);
  }, [initial, form]);
  const showActions = !editing || formState.isDirty || saving;

  const onSubmit = handleSubmit((values) => {
    startSaving(async () => {
      const res = await saveTestimonial({ ...values, id: initial?.id });
      if (!res.ok) {
        for (const [path, message] of Object.entries(res.fieldErrors ?? {})) setError(path as never, { message });
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Testimonial saved" : "Testimonial added");
      if (editing) {
        form.reset(form.getValues());
        router.refresh();
      } else router.push("/admin/testimonials");
    });
  });

  function onDelete() {
    if (!initial) return;
    startDeleting(async () => {
      const res = await deleteTestimonial(initial.id);
      if (!res.ok) {
        toast.error(res.error);
        setConfirmDelete(false);
        return;
      }
      toast.success("Testimonial deleted");
      router.push("/admin/testimonials");
    });
  }

  const mediaError = errors.media?.message ?? errors.media?.root?.message;

  return (
    <form onSubmit={onSubmit} noValidate className={cn("space-y-3 lg:space-y-5 lg:pb-0", showActions && "pb-20")}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-5">
        <div className="space-y-3 lg:col-span-2 lg:space-y-5">
          <Card className="space-y-4">
            <Controller
              control={control}
              name="rating"
              render={({ field }) => (
                <Field label="Rating" error={errors.rating?.message}>
                  <StarPicker value={field.value} onChange={field.onChange} />
                </Field>
              )}
            />
            <Field
              label="What the client said"
              error={errors.body?.message}
              hint={`Shown as a quote on the homepage · up to ${TESTIMONIAL_LIMITS.body} characters`}
              htmlFor="body"
            >
              <textarea
                id="body"
                rows={5}
                className={cn(inputClass, "h-auto py-3 leading-relaxed")}
                placeholder="The packaging alone felt like a gift…"
                aria-invalid={!!errors.body}
                {...register("body")}
              />
            </Field>
          </Card>

          <Card>
            <div className="mb-4">
              <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Photo or video</h2>
              <p className="mt-1 text-xs text-mute">Optional. A client photo, an unboxing clip or a video message.</p>
            </div>
            <Controller
              control={control}
              name="media"
              render={({ field }) => (
                <MediaUpload value={field.value} onChange={field.onChange} folder="testimonials" max={1} invalid={!!mediaError} />
              )}
            />
            {mediaError && (
              <p className="mt-2 text-xs text-red-400" role="alert">
                {mediaError}
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-3 lg:space-y-5">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ivory">Show on homepage</p>
                <p className="text-xs text-mute">Hidden testimonials are kept for later.</p>
              </div>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Show on homepage" />}
              />
            </div>
          </Card>
          <Card className="space-y-4">
            <Field label="Client name" error={errors.name?.message} htmlFor="name">
              <input id="name" className={inputClass} placeholder="e.g. Ayesha K." aria-invalid={!!errors.name} {...register("name")} />
            </Field>
            <Field label="City" error={errors.city?.message} hint="Optional" htmlFor="city">
              <input id="city" className={inputClass} placeholder="e.g. Hyderabad" {...register("city")} />
            </Field>
          </Card>
        </div>
      </div>

      {editing && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-red-500/20">
          <div>
            <p className="text-sm text-ivory">Delete testimonial</p>
            <p className="text-xs text-mute">Removes it and its photo/video permanently.</p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="h-10 rounded-lg border border-red-500/40 px-4 text-sm text-red-300 hover:bg-red-500/10"
          >
            Delete
          </button>
        </Card>
      )}

      {showActions && <FormActions cancelHref="/admin/testimonials" saving={saving} label={editing ? "Save changes" : "Add testimonial"} />}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this testimonial?"
        body={<>“{initial?.name}” and its photo/video will be removed permanently.</>}
        pending={deleting}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}
