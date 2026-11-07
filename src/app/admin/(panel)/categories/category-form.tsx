"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Control, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, Plus, Trash2, X } from "lucide-react";
import { Card } from "@/components/admin/ui";
import { Field, Switch, inputClass, ConfirmDialog, FormActions } from "@/components/admin/form";
import { ImageUpload } from "@/components/admin/image-upload";
import {
  categoryFormSchema,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  keyify,
  slugify,
  splitOptions,
  type CategoryFormValues,
} from "@/lib/validation/category";
import { enqueue, pendingSave } from "@/components/admin/outbox";
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
  const { register, control, handleSubmit, setValue, getValues, formState } = form;
  const errors = formState.errors;
  const fieldsArray = useFieldArray({ control, name: "fields", keyName: "rhfId" });

  // After a save the page re-renders with fresh server data. Load it into the form so
  // it's clean again (hides the save bar) and newly added rows pick up their ids.
  // Unsaved edits are never overwritten by a background refresh.
  // If a save for this category is still queued, show those values (newer than the server's).
  useEffect(() => {
    if (!initial || form.formState.isDirty) return;
    const queued = pendingSave(initial.id)?.formValues as CategoryFormValues | undefined;
    form.reset(queued ?? initial);
  }, [initial, form]);
  const showActions = formState.isDirty;

  // SSR-stable id for dnd-kit's aria-describedby (its own counter differs between server and browser → hydration mismatch).
  const dndId = useId();
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
    const id = initial?.id ?? crypto.randomUUID();
    const payload = {
      ...values,
      id,
      imageUrl: values.imageUrl ?? "",
      fields: values.fields.map(({ optionsText, ...f }) => ({ ...f, options: splitOptions(optionsText) })),
    };
    // Optimistic: show it as saved now; the outbox sends it in the background.
    enqueue({
      kind: "category.save",
      entityId: id,
      label: values.name,
      payload,
      formValues: form.getValues(),
      editHref: editing ? `/admin/categories/${id}` : undefined,
      preview: {
        id,
        name: values.name,
        slug: values.slug,
        description: values.description || null,
        imageUrl: values.imageUrl || null,
        isActive: values.isActive,
        productCount: editing ? productCount : 0,
        fieldCount: values.fields.length,
      },
    });
    toast.success(editing ? "Category saved" : "Category created");
    form.reset(form.getValues());
    router.push("/admin/categories");
  });

  function onDelete() {
    if (!initial) return;
    enqueue({ kind: "category.delete", entityId: initial.id, label: initial.name, payload: initial.id });
    toast.success("Category deleted");
    router.push("/admin/categories");
  }

  const fieldErrors = errors.fields;

  return (
    <form onSubmit={onSubmit} noValidate className={cn("space-y-3 lg:space-y-5 lg:pb-0", showActions && "pb-20")}>
      <div className="grid gap-3 lg:grid-cols-3 lg:gap-5">
        {/* Details */}
        <Card className="space-y-4 lg:col-span-2">
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

          <Field label="URL slug" error={errors.slug?.message} htmlFor="slug">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-xs text-mute">/shop/</span>
              <input
                id="slug"
                className={cn(inputClass, "pl-[4.1rem] font-mono text-xs")}
                aria-invalid={!!errors.slug}
                {...register("slug", { onChange: () => setSlugTouched(true) })}
              />
            </div>
          </Field>

          <Field label="Short description" error={errors.description?.message} htmlFor="description">
            <input id="description" className={inputClass} placeholder="e.g. Timepieces of distinction" {...register("description")} />
          </Field>

          <div className="flex items-center justify-between rounded-lg border border-ink-600/70 px-4 py-3">
            <p className="text-sm text-ivory">Visible in store</p>
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Visible in store" />}
            />
          </div>
        </Card>

        {/* Image */}
        <Card>
          <Field label="Cover image" error={errors.imageUrl?.message}>
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Product fields</h2>
          <span className="text-xs text-mute">{fieldsArray.fields.length} / 30</span>
        </div>

        {typeof fieldErrors?.message === "string" && <p className="mb-3 text-xs text-red-400">{fieldErrors.message}</p>}

        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
          <SortableContext items={fieldsArray.fields.map((f) => f.rhfId)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {fieldsArray.fields.map((f, i) => (
                <FieldRow
                  key={f.rhfId}
                  sortId={f.rhfId}
                  index={i}
                  control={control}
                  register={register}
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
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-gold-500/40 px-4 text-sm text-gold-300 hover:bg-gold-500/5 disabled:opacity-50"
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

      {showActions && (
        <FormActions cancelHref="/admin/categories" saving={false} label={editing ? "Save changes" : "Create category"} />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this category?"
        body={<>“{initial?.name}” and its field definitions will be removed permanently.</>}
        pending={false}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}

type RowErrors = Partial<Record<"label" | "key" | "optionsText" | "unit", { message?: string }>> | undefined;

const rowInput = cn(inputClass, "h-9 px-2.5");

function FieldRow({
  sortId,
  index,
  control,
  register,
  errors,
  onLabelChange,
  onRemove,
}: {
  sortId: string;
  index: number;
  control: Control<CategoryFormValues, unknown, Output>;
  register: UseFormRegister<CategoryFormValues>;
  errors: RowErrors;
  onLabelChange: (label: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: sortId });
  const type = useWatch({ control, name: `fields.${index}.type` });
  const hasUnit = type === "text" || type === "number";
  // The key is generated from the label and never shown; surface its errors under the label.
  const labelError = errors?.label?.message ?? errors?.key?.message;
  const optionsText = useWatch({ control, name: `fields.${index}.optionsText` }) ?? "";
  const optionCount = splitOptions(optionsText).length;
  // null = user hasn't toggled yet: open while there are no options so they're easy to add.
  const [optionsOpen, setOptionsOpen] = useState<boolean | null>(null);
  const showOptions = type === "select" && (optionsOpen ?? optionCount === 0);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "rounded-lg border border-ink-600/70 bg-ink-900/70 py-2 pr-1 pl-0.5 sm:p-2.5",
        isDragging && "relative z-10 border-gold-500/40 shadow-2xl",
      )}
    >
      <div className="flex gap-1 sm:gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="flex h-9 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-mute hover:text-gold-400 active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-[1fr_8rem_10rem]">
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <input
              className={rowInput}
              placeholder="Field label, e.g. Movement"
              aria-label="Field label"
              aria-invalid={!!labelError}
              {...register(`fields.${index}.label`, { onChange: (e) => onLabelChange(e.target.value) })}
            />
            <input type="hidden" aria-label="Field key" {...register(`fields.${index}.key`)} />
            {labelError && <p className="text-xs text-red-400">{labelError}</p>}
          </div>
          <select className={cn(rowInput, "select-chevron pr-6", !hasUnit && type !== "select" && "col-span-2 sm:col-span-2")} aria-label="Field type" {...register(`fields.${index}.type`)}>
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>

          {hasUnit && (
            <input className={rowInput} placeholder="Unit (mm, ml…)" aria-label="Unit" {...register(`fields.${index}.unit`)} />
          )}

          {type === "select" && (
            <button
              type="button"
              onClick={() => setOptionsOpen(!showOptions)}
              aria-expanded={showOptions}
              className={cn(
                rowInput,
                "flex items-center justify-between gap-1 text-left",
                showOptions && "border-gold-500/50",
                errors?.optionsText && "border-red-500/60",
              )}
            >
              <span className={cn("truncate", optionCount === 0 && "text-mute")}>
                {optionCount === 0 ? "Add options" : `${optionCount} option${optionCount === 1 ? "" : "s"}`}
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-mute transition-transform", showOptions && "rotate-180")} />
            </button>
          )}

          {type === "select" && errors?.optionsText?.message && (
            <p className="col-span-full text-xs text-red-400">{errors.optionsText.message}</p>
          )}

          {showOptions && (
            <Controller
              control={control}
              name={`fields.${index}.optionsText`}
              render={({ field }) => <OptionsEditor value={field.value ?? ""} onChange={field.onChange} />}
            />
          )}

          <div className="col-span-full flex flex-nowrap items-center gap-x-4">
            <Controller
              control={control}
              name={`fields.${index}.required`}
              render={({ field }) => (
                <label className="flex items-center gap-2 text-xs whitespace-nowrap text-stone">
                  <Switch size="sm" checked={field.value ?? false} onChange={field.onChange} label="Required" /> Required
                </label>
              )}
            />
            <Controller
              control={control}
              name={`fields.${index}.filterable`}
              render={({ field }) => (
                <label className="flex items-center gap-2 text-xs whitespace-nowrap text-stone">
                  <Switch size="sm" checked={field.value ?? false} onChange={field.onChange} label="Shop filter" /> Shop filter
                </label>
              )}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove field"
          className="grid h-9 w-7 shrink-0 place-items-center rounded-lg text-mute hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

/**
 * One input per dropdown option. The form still stores them as a single
 * comma-separated string (optionsText), so commas are stripped from each option.
 */
function OptionsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [items, setItems] = useState(() => splitOptions(value));
  const [draft, setDraft] = useState("");

  const commit = (next: string[]) => {
    setItems(next);
    onChange(next.join(", "));
  };
  const add = () => {
    const v = draft.replace(/,/g, "").trim();
    if (!v) return;
    if (!items.some((o) => o.trim().toLowerCase() === v.toLowerCase())) commit([...items, v]);
    setDraft("");
  };

  return (
    <div className="col-span-full space-y-1.5 rounded-lg border border-ink-600/60 bg-ink-950/40 p-2">
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((opt, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <input
                className={cn(rowInput, "h-8")}
                value={opt}
                aria-label={`Option ${i + 1}`}
                onChange={(e) => commit(items.map((o, j) => (j === i ? e.target.value.replace(/,/g, "") : o)))}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              />
              <button
                type="button"
                onClick={() => commit(items.filter((_, j) => j !== i))}
                aria-label={`Remove option ${opt || i + 1}`}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-mute hover:bg-red-500/10 hover:text-red-300"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-1.5">
        <input
          className={cn(rowInput, "h-8")}
          value={draft}
          placeholder={items.length === 0 ? "First option, e.g. Automatic" : "Add option"}
          aria-label="New dropdown option"
          onChange={(e) => setDraft(e.target.value.replace(/,/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          aria-label="Add option"
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-gold-500/40 text-gold-300 hover:bg-gold-500/10 disabled:opacity-40"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
