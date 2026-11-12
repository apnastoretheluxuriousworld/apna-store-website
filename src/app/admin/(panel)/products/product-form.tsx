"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Control, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/admin/ui";
import { Field, Switch, inputClass, selectClass, ConfirmDialog, FormActions } from "@/components/admin/form";
import { GalleryUpload } from "@/components/admin/gallery-upload";
import {
  LIMITS,
  normalizeAttributes,
  productInputSchema,
  totalStock,
  type ProductOutput,
} from "@/lib/validation/product";
import type { CategoryWithFields } from "@/lib/data/products";
import { formatPrice } from "@/lib/format";
import { enqueue, pendingSave } from "@/components/admin/outbox";
import { coverOf } from "@/lib/media";
import { cn, trimLeadingZeros } from "@/lib/utils";
import { ProductPreview } from "./product-preview";

export type ProductFormValues = {
  id?: string;
  categoryId: string;
  name: string;
  slug?: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  sku: string;
  stock: number;
  trackStock: boolean;
  status: "draft" | "active";
  isFeatured: boolean;
  attributes: Record<string, string | boolean>;
  customAttributes: { name: string; value: string }[];
  images: { url: string; alt: string }[];
  variants: { id?: string; label: string; sku: string; priceOverride: number | null; stock: number }[];
};

type Ctl = Control<ProductFormValues, unknown, ProductOutput>;

const resolver = zodResolver(productInputSchema) as unknown as Resolver<ProductFormValues, unknown, ProductOutput>;

/** Number inputs: empty box → NaN, which the schema turns into null / "required". */
const num = { valueAsNumber: true } as const;

export function ProductForm({
  categories,
  initial,
  defaultCategoryId,
}: {
  categories: CategoryWithFields[];
  initial?: ProductFormValues & { id: string };
  defaultCategoryId?: string;
}) {
  const router = useRouter();
  const editing = !!initial;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<ProductFormValues, unknown, ProductOutput>({
    resolver,
    defaultValues: initial ?? {
      categoryId: defaultCategoryId ?? "",
      name: "",
      slug: "",
      description: "",
      price: NaN,
      compareAtPrice: null,
      sku: "",
      stock: 1,
      trackStock: true,
      status: "draft",
      isFeatured: false,
      attributes: {},
      customAttributes: [],
      images: [],
      variants: [],
    },
  });
  const { register, control, handleSubmit, setError, formState } = form;
  const errors = formState.errors;
  const custom = useFieldArray({ control, name: "customAttributes" });
  const variants = useFieldArray({ control, name: "variants", keyName: "rhfId" });

  // After a save the page re-renders with fresh server data. Load it into the form so
  // it's clean again (hides the save bar) and newly added rows pick up their ids.
  // Unsaved edits are never overwritten by a background refresh.
  // If a save for this product is still queued (offline, or still syncing), the
  // server data is older than what the admin last saved: show the queued values.
  useEffect(() => {
    if (!initial || form.formState.isDirty) return;
    const queued = pendingSave(initial.id)?.formValues as ProductFormValues | undefined;
    form.reset(queued ?? initial);
  }, [initial, form]);
  const showActions = formState.isDirty;

  const categoryId = useWatch({ control, name: "categoryId" });
  const category = categories.find((c) => c.id === categoryId);

  const onSubmit = handleSubmit((values) => {
    // Same check the server runs, so errors show without a round trip.
    const { errors: attrErrors } = normalizeAttributes(category?.fields ?? [], values.attributes);
    if (Object.keys(attrErrors).length) {
      for (const [k, message] of Object.entries(attrErrors)) setError(`attributes.${k}`, { message });
      toast.error("Please fill in the category details.");
      return;
    }
    // Optimistic: show it as saved now; the outbox sends it in the background.
    const id = initial?.id ?? crypto.randomUUID();
    enqueue({
      kind: "product.save",
      entityId: id,
      label: values.name,
      payload: { ...values, id },
      formValues: form.getValues(),
      editHref: editing ? `/admin/products/${id}` : undefined,
      preview: {
        id,
        name: values.name,
        sku: values.sku || null,
        price: values.price,
        compareAtPrice: values.compareAtPrice ?? null,
        stock: totalStock(values.stock, values.variants),
        trackStock: values.trackStock,
        status: values.status,
        isFeatured: values.isFeatured,
        categoryName: category?.name ?? "",
        imageUrl: coverOf(values.images)?.url ?? null,
        variantCount: values.variants.length,
        updatedAt: new Date().toISOString(),
      },
    });
    toast.success(editing ? "Product saved" : "Product created");
    form.reset(form.getValues());
    router.push("/admin/products");
  });

  function onDelete() {
    if (!initial) return;
    enqueue({ kind: "product.delete", entityId: initial.id, label: initial.name, payload: initial.id });
    toast.success("Product deleted");
    router.push("/admin/products");
  }

  const imagesError = errors.images?.message ?? errors.images?.root?.message;

  return (
    <form onSubmit={onSubmit} noValidate className={cn("space-y-3 lg:space-y-5 lg:pb-0", showActions && "pb-20")}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-5">
        {/* ── Main column ── */}
        <div className="space-y-3 lg:col-span-2 lg:space-y-5">
          <Card className="space-y-4">
            <Field label="Name" error={errors.name?.message} htmlFor="name">
              <input
                id="name"
                className={inputClass}
                placeholder="e.g. Aurum Chronograph 42"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
            </Field>
            <Field label="Description" error={errors.description?.message} htmlFor="description">
              <textarea
                id="description"
                rows={2}
                // Starts at 2 lines and grows with the text (up to ~10 lines, then scrolls)
                className={cn(inputClass, "field-sizing-content h-auto max-h-64 min-h-18 py-2.5 leading-relaxed")}
                placeholder="Materials, craftsmanship, what's in the box…"
                {...register("description")}
              />
            </Field>
          </Card>

          <Card>
            <SectionTitle title="Photos & videos" />
            <Controller
              control={control}
              name="images"
              render={({ field }) => (
                <GalleryUpload value={field.value} onChange={field.onChange} max={LIMITS.images} invalid={!!imagesError} />
              )}
            />
            {imagesError && (
              <p className="mt-2 text-xs text-red-400" role="alert">
                {imagesError}
              </p>
            )}
          </Card>

          <Card>
            {/* Category first: picking one shows its fields right below */}
            <Field label="Category" error={errors.categoryId?.message} htmlFor="categoryId">
              <select id="categoryId" className={selectClass} aria-invalid={!!errors.categoryId} {...register("categoryId")}>
                <option value="">Choose…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.isActive ? "" : " (hidden)"}
                  </option>
                ))}
              </select>
            </Field>
            {category && (
              <Link href={`/admin/categories/${category.id}`} className="mt-1.5 inline-block text-xs text-gold-400 hover:underline">
                Edit {category.name} fields
              </Link>
            )}
            {category && category.fields.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {category.fields.map((f) => (
                  <AttributeInput key={`${category.id}-${f.key}`} field={f} control={control} register={register} error={errors.attributes?.[f.key]?.message} />
                ))}
              </div>
            )}
            {category && category.fields.length === 0 && <p className="mt-3 text-sm text-mute">This category has no fields yet.</p>}

            {/* Product-only fields */}
            <div className="mt-6 border-t border-ink-600/60 pt-5">
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-stone">Extra details for this product only</p>
              <p className="mt-1 text-xs text-mute">e.g. “Box &amp; papers: Included” or “Limited edition: 1 of 50”.</p>
              <ul className="mt-3 space-y-2">
                {custom.fields.map((f, i) => (
                  <li key={f.id} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
                    <div>
                      <input
                        className={cn(inputClass, "h-10")}
                        placeholder="Name"
                        aria-label="Detail name"
                        aria-invalid={!!errors.customAttributes?.[i]?.name}
                        {...register(`customAttributes.${i}.name`)}
                      />
                      <ErrorText msg={errors.customAttributes?.[i]?.name?.message} />
                    </div>
                    <div>
                      <input
                        className={cn(inputClass, "h-10")}
                        placeholder="Value"
                        aria-label="Detail value"
                        aria-invalid={!!errors.customAttributes?.[i]?.value}
                        {...register(`customAttributes.${i}.value`)}
                      />
                      <ErrorText msg={errors.customAttributes?.[i]?.value?.message} />
                    </div>
                    <RemoveButton label="Remove detail" onClick={() => custom.remove(i)} />
                  </li>
                ))}
              </ul>
              <AddButton
                label="Add detail"
                disabled={custom.fields.length >= LIMITS.customAttributes}
                onClick={() => custom.append({ name: "", value: "" })}
              />
            </div>
          </Card>

          <VariantsCard control={control} register={register} variants={variants} errors={errors.variants} />
        </div>

        {/* ── Side column ── */}
        <div className="space-y-3 lg:space-y-5">
          <Card className="space-y-4">
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <div>
                  <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-stone">Status</p>
                  <div role="radiogroup" aria-label="Status" className="grid grid-cols-2 rounded-lg border border-ink-600 bg-ink-900 p-1">
                    {(["draft", "active"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={field.value === s}
                        onClick={() => field.onChange(s)}
                        className={cn(
                          "h-9 rounded-md text-xs uppercase tracking-[0.16em] transition-colors",
                          field.value === s ? (s === "active" ? "bg-gold text-ink-950 font-semibold" : "bg-ink-700 text-ivory") : "text-mute hover:text-ivory",
                        )}
                      >
                        {s === "active" ? "Live" : "Draft"}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-mute">
                    {field.value === "active" ? "Visible in the store." : "Hidden from the store until you set it Live."}
                  </p>
                </div>
              )}
            />
            <div className="flex items-center justify-between gap-3 border-t border-ink-600/60 pt-4">
              <div>
                <p className="text-sm text-ivory">Featured</p>
                <p className="text-xs text-mute">Shown in “Best sellers” on the homepage.</p>
              </div>
              <Controller
                control={control}
                name="isFeatured"
                render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Featured" />}
              />
            </div>
          </Card>

          <Card className="space-y-4">
            <Field label="Price (₹)" error={errors.price?.message} htmlFor="price">
              <RupeeInput id="price" invalid={!!errors.price} {...register("price", num)} />
            </Field>
            <Field
              label="Compare-at price (₹)"
              error={errors.compareAtPrice?.message}
              hint={<CompareHint control={control} />}
              htmlFor="compareAtPrice"
            >
              <RupeeInput id="compareAtPrice" placeholder="Optional" invalid={!!errors.compareAtPrice} {...register("compareAtPrice", num)} />
            </Field>
          </Card>

          <Card className="space-y-4">
            <Field label="SKU" error={errors.sku?.message} htmlFor="sku">
              <input id="sku" className={cn(inputClass, "font-mono text-xs")} placeholder="Optional" {...register("sku")} />
            </Field>
            <StockField control={control} register={register} error={errors.stock?.message} />
            <div className="flex items-center justify-between gap-3 border-t border-ink-600/60 pt-4">
              <p className="text-sm text-ivory">Track stock</p>
              <Controller
                control={control}
                name="trackStock"
                render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Track stock" />}
              />
            </div>
          </Card>

          <Card className="lg:sticky lg:top-5">
            <ProductPreview control={control} categoryName={category?.name} />
          </Card>
        </div>
      </div>

      {editing && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-red-500/20">
          <div>
            <p className="text-sm text-ivory">Delete product</p>
            <p className="text-xs text-mute">Removes the product and its images. Past orders keep their own copy.</p>
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

      {showActions && (
        <FormActions cancelHref="/admin/products" saving={false} label={editing ? "Save changes" : "Create product"} />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this product?"
        body={<>“{initial?.name}” and its images will be removed permanently.</>}
        pending={false}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}

/* ───────────── Pieces ───────────── */

type Register = ReturnType<typeof useForm<ProductFormValues, unknown, ProductOutput>>["register"];

function SectionTitle({ title, note }: { title: string; note?: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">{title}</h2>
      {note && <p className="mt-1 text-xs text-mute">{note}</p>}
    </div>
  );
}

function ErrorText({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-red-400">{msg}</p> : null;
}

function AddButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-dashed border-gold-500/40 px-4 text-sm text-gold-300 hover:bg-gold-500/5 disabled:opacity-50"
    >
      <Plus className="size-4" /> {label}
    </button>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-10 place-items-center rounded-lg text-mute hover:bg-red-500/10 hover:text-red-300"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

function RupeeInput({ invalid, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-mute">₹</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        onInput={trimLeadingZeros}
        aria-invalid={invalid}
        className={cn(inputClass, "pl-8 tabular-nums", className)}
        {...props}
      />
    </div>
  );
}


function CompareHint({ control }: { control: Ctl }) {
  const [price, compare] = useWatch({ control, name: ["price", "compareAtPrice"] });
  if (Number.isFinite(price) && compare != null && Number.isFinite(compare) && compare > price) {
    return (
      <>
        Shown struck through: <s>{formatPrice(compare)}</s> → {formatPrice(price)} ({Math.round((1 - price / compare) * 100)}% off)
      </>
    );
  }
  return <>Optional. The original price, shown struck through.</>;
}

function StockField({ control, register, error }: { control: Ctl; register: Register; error?: string }) {
  const variants = useWatch({ control, name: "variants" });
  const trackStock = useWatch({ control, name: "trackStock" });
  if (!trackStock) {
    return (
      <Field label="Stock">
        <p className="flex h-11 items-center rounded-lg border border-ink-600/60 bg-ink-900/50 px-3.5 text-sm text-stone">Always available</p>
      </Field>
    );
  }
  if (variants.length) {
    const total = totalStock(0, variants.map((v) => ({ stock: Number.isFinite(v.stock) ? v.stock : 0 })));
    return (
      <Field label="Stock" hint="Set per variant below.">
        <p className="flex h-11 items-center rounded-lg border border-ink-600/60 bg-ink-900/50 px-3.5 text-sm text-stone tabular-nums">
          {total} in total
        </p>
      </Field>
    );
  }
  return (
    <Field label="Stock" error={error} htmlFor="stock">
      <input id="stock" type="number" inputMode="numeric" min={0} step={1} onInput={trimLeadingZeros} className={cn(inputClass, "tabular-nums")} aria-invalid={!!error} {...register("stock", num)} />
    </Field>
  );
}

function AttributeInput({
  field: f,
  control,
  register,
  error,
}: {
  field: CategoryWithFields["fields"][number];
  control: Ctl;
  register: Register;
  error?: string;
}) {
  const name = `attributes.${f.key}` as const;
  const label = f.label + (f.required ? " *" : "");
  const id = `attr-${f.key}`;

  if (f.type === "boolean") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-600/70 px-4 py-3 sm:self-end">
        <span className="text-sm text-ivory">{f.label}</span>
        <Controller
          control={control}
          name={name}
          render={({ field }) => <Switch checked={field.value === true} onChange={field.onChange} label={f.label} />}
        />
      </div>
    );
  }

  return (
    <Field label={label} error={error} htmlFor={id}>
      {f.type === "select" ? (
        <select id={id} className={selectClass} aria-invalid={!!error} {...register(name)}>
          <option value="">{f.required ? "Choose…" : "—"}</option>
          {f.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <div className="relative">
          <input
            id={id}
            inputMode={f.type === "number" ? "decimal" : undefined}
            onInput={f.type === "number" ? trimLeadingZeros : undefined}
            className={cn(inputClass, f.unit && "pr-12", f.type === "number" && "tabular-nums")}
            aria-invalid={!!error}
            {...register(name)}
          />
          {f.unit && <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-mute">{f.unit}</span>}
        </div>
      )}
    </Field>
  );
}

function VariantsCard({
  control,
  register,
  variants,
  errors,
}: {
  control: Ctl;
  register: Register;
  variants: ReturnType<typeof useFieldArray<ProductFormValues, "variants", "rhfId">>;
  errors: ReturnType<typeof useForm<ProductFormValues>>["formState"]["errors"]["variants"];
}) {
  const price = useWatch({ control, name: "price" });
  const trackStock = useWatch({ control, name: "trackStock" });
  // Without stock tracking the variant stock column goes away.
  const cols = trackStock ? "sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto]" : "sm:grid-cols-[1.4fr_1fr_1fr_auto]";
  return (
    <Card>
      <SectionTitle
        title="Variants"
      />
      {variants.fields.length > 0 && (
        <div className="space-y-2">
          <div className={cn("hidden gap-2 px-1 text-[0.6rem] uppercase tracking-[0.16em] text-mute sm:grid", cols)}>
            <span>Label</span>
            <span>SKU</span>
            <span>Price (₹)</span>
            {trackStock && <span>Stock</span>}
            <span className="w-10" />
          </div>
          <ul className="space-y-2">
            {variants.fields.map((v, i) => (
              <li
                key={v.rhfId}
                className={cn("grid grid-cols-2 gap-2 rounded-lg border border-ink-600/60 p-2 sm:border-0 sm:p-0", cols)}
              >
                <div className="col-span-2 sm:col-span-1">
                  <VariantLabel htmlFor={`variant-${i}-label`}>Label</VariantLabel>
                  <input
                    id={`variant-${i}-label`}
                    className={cn(inputClass, "h-10")}
                    placeholder="e.g. UK 8"
                    aria-label="Variant label"
                    aria-invalid={!!errors?.[i]?.label}
                    {...register(`variants.${i}.label`)}
                  />
                  <ErrorText msg={errors?.[i]?.label?.message} />
                </div>
                <div>
                  <VariantLabel htmlFor={`variant-${i}-sku`}>SKU</VariantLabel>
                  <input
                    id={`variant-${i}-sku`}
                    className={cn(inputClass, "h-10 font-mono text-xs")}
                    placeholder="SKU"
                    aria-label="Variant SKU"
                    {...register(`variants.${i}.sku`)}
                  />
                </div>
                <div>
                  <VariantLabel htmlFor={`variant-${i}-price`}>Price (₹)</VariantLabel>
                  <input
                    id={`variant-${i}-price`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    onInput={trimLeadingZeros}
                    className={cn(inputClass, "h-10 tabular-nums")}
                    placeholder={Number.isFinite(price) ? String(price) : "Same"}
                    aria-label="Variant price"
                    aria-invalid={!!errors?.[i]?.priceOverride}
                    {...register(`variants.${i}.priceOverride`, num)}
                  />
                  <ErrorText msg={errors?.[i]?.priceOverride?.message} />
                </div>
                <div className={cn(!trackStock && "hidden")}>
                  <VariantLabel htmlFor={`variant-${i}-stock`}>Stock</VariantLabel>
                  <input
                    id={`variant-${i}-stock`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    onInput={trimLeadingZeros}
                    className={cn(inputClass, "h-10 tabular-nums")}
                    aria-label="Variant stock"
                    aria-invalid={!!errors?.[i]?.stock}
                    {...register(`variants.${i}.stock`, num)}
                  />
                  <ErrorText msg={errors?.[i]?.stock?.message} />
                </div>
                <div className="flex items-end justify-end">
                  <RemoveButton label="Remove variant" onClick={() => variants.remove(i)} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <AddButton
        label="Add variant"
        disabled={variants.fields.length >= LIMITS.variants}
        onClick={() => variants.append({ label: "", sku: "", priceOverride: null, stock: 1 })}
      />
    </Card>
  );
}

/** Phones only: the variant table's column headings are hidden there, so each input gets its own label. */
function VariantLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block px-0.5 text-[0.6rem] uppercase tracking-[0.16em] text-mute sm:hidden">
      {children}
    </label>
  );
}
