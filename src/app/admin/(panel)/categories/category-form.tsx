"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Control, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/admin/ui";
import { Field, Switch, inputClass, ConfirmDialog } from "@/components/admin/form";
import { ImageUpload } from "@/components/admin/image-upload";
import { Button } from "@/components/ui/button";
import {
  categoryFormSchema,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  keyify,
  slugify,
  splitOptions,
  type CategoryFormValues,
} from "@/lib/validation/category";
import { deleteCategory, saveCategory } from "./actions";
import { cn } from "@/lib/utils";

type Output = z.output<typeof categoryFormSchema>;

const newField = (): CategoryFormValues["fields"][number] => ({
  label: "",
  key: "",
  type: "text",
  optionsText: "",
  unit: "",
  required: false,
  filterable: false,
});

export function CategoryForm({
  initial,
  productCount = 0,
}: {
  initial?: CategoryFormValues & { id: string };
  productCount?: number;
}) {
  const router = useRouter();
  const editing = !!initial;
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [slugTouched, setSlugTouched] = useState(editing);

  const form = useForm<CategoryFormValues, unknown, Output>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: initial ?? {
      name: "",
      slug: "",
      description: "",
      imageUrl: "",
      isActive: true,
      fields: [{ ...newField(), label: "Brand", key: "brand", required: true, filterable: true }],
    },
  });
  const { register, control, handleSubmit, setValue, getValues, setError, formState } = form;
  const errors = formState.errors;
  const fieldsArray = useFieldArray({ control, name: "fields", keyName: "rhfId" });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = fieldsArray.fields.findIndex((f) => f.rhfId === e.active.id);
    const to = fieldsArray.fields.findIndex((f) => f.rhfId === e.over!.id);
    fieldsArray.move(from, to);
  }

  const onSubmit = handleSubmit((values) => {
    const payload = {
      ...values,
      id: initial?.id,
      imageUrl: values.imageUrl ?? "",
      fields: values.fields.map(({ optionsText, ...f }) => ({ ...f, options: splitOptions(optionsText) })),
    };
    startSaving(async () => {
      const res = await saveCategory(payload);
      if (!res.ok) {
        for (const [path, message] of Object.entries(res.fieldErrors ?? {})) {
          setError(path.replace(/^fields\.(\d+)\.options$/, "fields.$1.optionsText") as never, { message });
        }
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Category saved" : "Category created");
      if (editing) router.refresh();
      else router.push(`/admin/categories/${res.data.id}`);
    });
  });

  function onDelete() {
    if (!initial) return;
    startDeleting(async () => {
      const res = await deleteCategory(initial.id);
      if (!res.ok) {
        toast.error(res.error);
        setConfirmDelete(false);
        return;
      }
      toast.success("Category deleted");
      router.push("/admin/categories");
    });
  }

  const fieldErrors = errors.fields;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 pb-20 lg:space-y-6 lg:pb-0">
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {/* Details */}
        <Card className="space-y-5 lg:col-span-2">
          <Field label="Name" error={errors.name?.message} htmlFor="name">
            <input
              id="name"
              className={inputClass}
              placeholder="e.g. Watches"
              aria-invalid={!!errors.name}
              {...register("name", {
                onChange: (e) => !slugTouched && setValue("slug", slugify(e.target.value)),
              })}
            />
          </Field>

          <Field
            label="URL slug"
            error={errors.slug?.message}
            hint={<SlugHint control={control} />}
            htmlFor="slug"
          >
            <input
              id="slug"
              className={cn(inputClass, "font-mono text-xs")}
              aria-invalid={!!errors.slug}
              {...register("slug", { onChange: () => setSlugTouched(true) })}
            />
          </Field>

          <Field label="Short description" error={errors.description?.message} hint="Shown under the name in menus and on the collection page." htmlFor="description">
            <input id="description" className={inputClass} placeholder="e.g. Timepieces of distinction" {...register("description")} />
          </Field>

          <div className="flex items-center justify-between rounded-lg border border-ink-600/70 px-4 py-3">
            <div>
              <p className="text-sm text-ivory">Visible in store</p>
              <p className="text-xs text-mute">Hidden categories stay in admin but disappear from the shop.</p>
            </div>
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Visible in store" />}
            />
          </div>
        </Card>

        {/* Image */}
        <Card>
          <Field label="Cover image" error={errors.imageUrl?.message} hint="Used on the Shop page tiles. Portrait 4:5 works best.">
            <Controller
              control={control}
              name="imageUrl"
              render={({ field }) => (
                <ImageUpload folder="categories" value={field.value || null} onChange={(url) => field.onChange(url ?? "")} />
              )}
            />
          </Field>
        </Card>
      </div>

      {/* Fields builder */}
      <Card>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Product fields</h2>
            <p className="mt-1 max-w-xl text-xs text-mute">
              Every product in this category gets these fields (e.g. Movement, Case Size). Drag to reorder. Admins can
              still add extra fields to a single product.
            </p>
          </div>
          <span className="text-xs text-mute">{fieldsArray.fields.length} / 30</span>
        </div>

        {typeof fieldErrors?.message === "string" && <p className="mb-3 text-xs text-red-400">{fieldErrors.message}</p>}

        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
          <SortableContext items={fieldsArray.fields.map((f) => f.rhfId)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-3">
              {fieldsArray.fields.map((f, i) => (
                <FieldRow
                  key={f.rhfId}
                  sortId={f.rhfId}
                  index={i}
                  control={control}
                  register={register}
                  locked={!!f.id}
                  errors={fieldErrors?.[i]}
                  onLabelChange={(label) => {
                    const cur = getValues(`fields.${i}`);
                    if (!cur.id && (cur.key === "" || cur.key === keyify(cur.label))) {
                      setValue(`fields.${i}.key`, keyify(label));
                    }
                  }}
                  onRemove={() => fieldsArray.remove(i)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        <button
          type="button"
          onClick={() => fieldsArray.append(newField())}
          disabled={fieldsArray.fields.length >= 30}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-gold-500/40 px-4 text-sm text-gold-300 hover:bg-gold-500/5 disabled:opacity-50"
        >
          <Plus className="size-4" /> Add field
        </button>
      </Card>

      {editing && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-red-500/20">
          <div>
            <p className="text-sm text-ivory">Delete category</p>
            <p className="text-xs text-mute">
              {productCount > 0
                ? `It has ${productCount} product${productCount === 1 ? "" : "s"} — move or delete them first.`
                : "Removes the category and its field definitions. This can't be undone."}
            </p>
          </div>
          <button
            type="button"
            disabled={productCount > 0}
            onClick={() => setConfirmDelete(true)}
            className="h-10 rounded-lg border border-red-500/40 px-4 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-40"
          >
            Delete
          </button>
        </Card>
      )}

      {/* Sticky save bar (above the admin bottom bar on mobile) */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-ink-600/60 bg-ink-950/90 px-4 py-3 backdrop-blur-xl lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="flex items-center justify-end gap-2">
          <Link href="/admin/categories" className="h-11 rounded-md px-4 text-sm leading-11 text-stone hover:text-ivory">
            Cancel
          </Link>
          <Button type="submit" disabled={saving} className="min-w-36">
            {saving ? <Loader2 className="size-4 animate-spin" /> : editing ? "Save changes" : "Create category"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this category?"
        body={<>“{initial?.name}” and its field definitions will be removed permanently.</>}
        pending={deleting}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}

function SlugHint({ control }: { control: Control<CategoryFormValues, unknown, Output> }) {
  const slug = useWatch({ control, name: "slug" });
  return (
    <>
      Page address: <span className="font-mono text-stone">/shop/{slug || "…"}</span>
    </>
  );
}

type RowErrors = Partial<Record<"label" | "key" | "optionsText" | "unit", { message?: string }>> | undefined;

function FieldRow({
  sortId,
  index,
  control,
  register,
  locked,
  errors,
  onLabelChange,
  onRemove,
}: {
  sortId: string;
  index: number;
  control: Control<CategoryFormValues, unknown, Output>;
  register: UseFormRegister<CategoryFormValues>;
  locked: boolean;
  errors: RowErrors;
  onLabelChange: (label: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: sortId });
  const type = useWatch({ control, name: `fields.${index}.type` });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "rounded-xl border border-ink-600/70 bg-ink-900/70 p-3 sm:p-4",
        isDragging && "relative z-10 border-gold-500/40 shadow-2xl",
      )}
    >
      <div className="flex gap-2 sm:gap-3">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="mt-2 flex h-7 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-mute hover:text-gold-400 active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>

        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[1fr_10rem]">
          <div className="space-y-1">
            <input
              className={inputClass}
              placeholder="Field label, e.g. Movement"
              aria-label="Field label"
              aria-invalid={!!errors?.label}
              {...register(`fields.${index}.label`, { onChange: (e) => onLabelChange(e.target.value) })}
            />
            {errors?.label?.message && <p className="text-xs text-red-400">{errors.label.message}</p>}
          </div>
          <select className={inputClass} aria-label="Field type" {...register(`fields.${index}.type`)}>
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>

          <div className="space-y-1">
            <div className="relative">
              <input
                className={cn(inputClass, "h-9 pr-8 font-mono text-xs", locked && "text-mute")}
                placeholder="key"
                aria-label="Field key"
                readOnly={locked}
                title={locked ? "Keys can't change after saving — products store values under this key" : undefined}
                aria-invalid={!!errors?.key}
                {...register(`fields.${index}.key`)}
              />
              {locked && <Lock className="absolute top-1/2 right-3 size-3 -translate-y-1/2 text-mute" />}
            </div>
            {errors?.key?.message && <p className="text-xs text-red-400">{errors.key.message}</p>}
          </div>
          {type === "text" || type === "number" ? (
            <input className={cn(inputClass, "h-9 text-xs")} placeholder="Unit (mm, ml…)" aria-label="Unit" {...register(`fields.${index}.unit`)} />
          ) : (
            <span className="hidden sm:block" />
          )}

          {type === "select" && (
            <div className="space-y-1 sm:col-span-2">
              <input
                className={cn(inputClass, "h-9 text-xs")}
                placeholder="Options, comma separated — e.g. Automatic, Quartz, Manual"
                aria-label="Dropdown options"
                aria-invalid={!!errors?.optionsText}
                {...register(`fields.${index}.optionsText`)}
              />
              {errors?.optionsText?.message && <p className="text-xs text-red-400">{errors.optionsText.message}</p>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:col-span-2">
            <Controller
              control={control}
              name={`fields.${index}.required`}
              render={({ field }) => (
                <label className="flex items-center gap-2 text-xs text-stone">
                  <Switch size="sm" checked={field.value ?? false} onChange={field.onChange} label="Required" /> Required
                </label>
              )}
            />
            <Controller
              control={control}
              name={`fields.${index}.filterable`}
              render={({ field }) => (
                <label className="flex items-center gap-2 text-xs text-stone">
                  <Switch size="sm" checked={field.value ?? false} onChange={field.onChange} label="Shop filter" /> Show as
                  shop filter
                </label>
              )}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove field"
          className="mt-1.5 grid size-8 shrink-0 place-items-center rounded-lg text-mute hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}
