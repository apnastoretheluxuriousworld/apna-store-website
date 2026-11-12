"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check, Package, Search, X } from "lucide-react";
import { Card } from "@/components/admin/ui";
import { ConfirmDialog, Field, FormActions, Switch, inputClass } from "@/components/admin/form";
import { ImageUpload } from "@/components/admin/image-upload";
import { enqueue, pendingSave } from "@/components/admin/outbox";
import type { OfferProductOption } from "@/lib/data/offers";
import { formatPrice } from "@/lib/format";
import { OFFER_LIMITS, describeOffer, offerFormSchema } from "@/lib/validation/offer";
import { cn } from "@/lib/utils";

export type OfferFormValues = {
  coverUrl: string;
  title: string;
  description: string;
  pickCount: string;
  price: string;
  productIds: string[];
  startsOn: string;
  endsOn: string;
  isActive: boolean;
};

const EMPTY: OfferFormValues = {
  coverUrl: "",
  title: "",
  description: "",
  pickCount: "3",
  price: "",
  productIds: [],
  startsOn: "",
  endsOn: "",
  isActive: true,
};

const resolver = zodResolver(offerFormSchema) as unknown as Resolver<OfferFormValues>;

export function OfferForm({
  initial,
  products,
  sold,
}: {
  initial?: OfferFormValues & { id: string };
  products: OfferProductOption[];
  /** Edit only: bundles sold so far. */
  sold?: number;
}) {
  const router = useRouter();
  const editing = !!initial;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<OfferFormValues>({ resolver, defaultValues: initial ?? EMPTY });
  const { register, control, handleSubmit, formState } = form;
  const errors = formState.errors;
  const v = useWatch({ control }) as OfferFormValues;

  // Fresh server data (or a still-queued save, which is newer) — never over unsaved edits.
  useEffect(() => {
    if (!initial || form.formState.isDirty) return;
    const queued = pendingSave(initial.id)?.formValues as OfferFormValues | undefined;
    form.reset(queued ?? initial);
  }, [initial, form]);
  const showActions = !editing || formState.isDirty;

  function save(values: OfferFormValues) {
    const id = initial?.id ?? crypto.randomUUID();
    enqueue({
      kind: "offer.save",
      entityId: id,
      label: values.title,
      payload: { ...values, id },
      formValues: values,
      editHref: `/admin/offers/${id}`,
      preview: {
        id,
        title: values.title.trim(),
        description: values.description,
        coverUrl: values.coverUrl,
        pickCount: Number(values.pickCount),
        price: Number(values.price),
        productIds: values.productIds,
        startsOn: values.startsOn,
        endsOn: values.endsOn,
        isActive: values.isActive,
      },
    });
    toast.success(editing ? "Offer saved" : "Offer created");
    form.reset(values);
    router.push("/admin/offers");
  }
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => void handleSubmit(save)(e);

  function onDelete() {
    if (!initial) return;
    enqueue({ kind: "offer.delete", entityId: initial.id, label: initial.title, payload: initial.id });
    toast.success("Offer deleted");
    router.push("/admin/offers");
  }

  const chosen = (v.productIds ?? []).flatMap((id) => products.filter((p) => p.id === id));
  const pickCount = Number(v.pickCount) || 0;
  const price = Number(v.price) || 0;

  return (
    <form onSubmit={onSubmit} noValidate className={cn("space-y-3 lg:space-y-5 lg:pb-0", showActions && "pb-20")}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-5">
        <div className="space-y-3 lg:space-y-5">
          <Card>
            <Field
              label="Cover image"
              error={errors.coverUrl?.message}
              hint="4:5 looks best"
            >
              <Controller
                control={control}
                name="coverUrl"
                render={({ field }) => (
                  <ImageUpload folder="offers" aspect="aspect-4/5" value={field.value || null} onChange={(url) => field.onChange(url ?? "")} />
                )}
              />
            </Field>
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ivory">Offer on</p>
                <p className="text-xs text-mute">Switch off to hide it from the store at once.</p>
              </div>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Offer on" />}
              />
            </div>
          </Card>
          {sold != null && (
            <Card>
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">So far</p>
              <p className="mt-2 text-sm text-stone">
                <span className="text-ivory tabular-nums">{sold}</span> sold · cancelled orders don&apos;t count
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-3 lg:space-y-5">
          <Card className="space-y-4">
            <Field label="Title" error={errors.title?.message} htmlFor="title">
              <input
                id="title"
                maxLength={OFFER_LIMITS.title}
                className={inputClass}
                placeholder="Any 3 for ₹1,000"
                aria-invalid={!!errors.title}
                {...register("title")}
              />
            </Field>
            <Field label="Description" error={errors.description?.message} htmlFor="description">
              <textarea
                id="description"
                rows={3}
                maxLength={OFFER_LIMITS.description}
                className={cn(inputClass, "h-auto py-3 leading-relaxed")}
                placeholder="Type..."
                {...register("description")}
              />
            </Field>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">The deal</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Customer picks" error={errors.pickCount?.message} hint="How many items" htmlFor="pickCount">
                <input
                  id="pickCount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={OFFER_LIMITS.pickCount}
                  className={inputClass}
                  aria-invalid={!!errors.pickCount}
                  {...register("pickCount")}
                />
              </Field>
              <Field label="For" error={errors.price?.message} hint="Price for all of them" htmlFor="price">
                <span className="relative block">
                  <input
                    id="price"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className={cn(inputClass, "pl-8")}
                    placeholder="1000"
                    aria-invalid={!!errors.price}
                    {...register("price")}
                  />
                  <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-mute">₹</span>
                </span>
              </Field>
            </div>
            {pickCount > 0 && price > 0 && <DealCheck pickCount={pickCount} price={price} chosen={chosen} />}
          </Card>

          <Card className="space-y-3">
            <Controller
              control={control}
              name="productIds"
              render={({ field }) => (
                <ProductPicker products={products} value={field.value ?? []} onChange={field.onChange} error={errors.productIds?.message} />
              )}
            />
          </Card>

          <Card className="space-y-4">
            <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Valid dates</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts on" error={errors.startsOn?.message} hint="Blank = right away" htmlFor="startsOn">
                <input id="startsOn" type="date" className={cn(inputClass, "scheme-dark")} {...register("startsOn")} />
              </Field>
              <Field label="Ends on" error={errors.endsOn?.message} hint="Runs until midnight that day · blank = never ends" htmlFor="endsOn">
                <input id="endsOn" type="date" className={cn(inputClass, "scheme-dark")} aria-invalid={!!errors.endsOn} {...register("endsOn")} />
              </Field>
            </div>
          </Card>
        </div>
      </div>

      {editing && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-red-500/20">
          <div>
            <p className="text-sm text-ivory">Delete offer</p>
            <p className="text-xs text-mute">Removes it from the store. Past orders keep the offer&apos;s name on their items.</p>
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

      {showActions && <FormActions cancelHref="/admin/offers" saving={false} label={editing ? "Save changes" : "Create offer"} />}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this offer?"
        body={<>“{initial?.title}” will disappear from the store. Bags that already have it will ask the customer to remove it.</>}
        pending={false}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}

/** "What the customer saves": the cheapest and dearest mix at normal prices vs the offer price. */
function DealCheck({ pickCount, price, chosen }: { pickCount: number; price: number; chosen: OfferProductOption[] }) {
  if (!chosen.length) {
    return <p className="rounded-lg bg-ink-900 px-3.5 py-3 text-xs text-stone">{describeOffer({ pickCount, price })} · now choose the products below.</p>;
  }
  // Customers can pick the same product more than once, so the cheapest mix is n × the cheapest.
  const prices = chosen.map((p) => p.price).sort((a, b) => a - b);
  const low = prices[0] * pickCount;
  const high = prices[prices.length - 1] * pickCount;
  const fixed = chosen.length === pickCount;
  const exact = prices.reduce((a, b) => a + b, 0);
  return (
    <div className="rounded-lg bg-ink-900 px-3.5 py-3 text-xs">
      <p className="mb-1.5 text-[0.6rem] uppercase tracking-[0.2em] text-mute">What the customer sees</p>
      <p className="text-ivory">{describeOffer({ pickCount, price, productCount: chosen.length })}</p>
      <p className="mt-1 text-stone tabular-nums">
        Normally{" "}
        {fixed ? formatPrice(exact) : low === high ? formatPrice(low) : `${formatPrice(low)} – ${formatPrice(high)}`} for {pickCount} item
        {pickCount === 1 ? "" : "s"}
        {(fixed ? exact : low) > price && (
          <span className="text-emerald-300"> · saves {fixed ? formatPrice(exact - price) : `at least ${formatPrice(low - price)}`}</span>
        )}
      </p>
      {(fixed ? exact : low) <= price && (
        <p className="mt-1.5 text-amber-200">
          {fixed ? "These items cost less than the offer price at their normal prices." : "Some mixes cost less than the offer price at normal prices."}
        </p>
      )}
    </div>
  );
}

function ProductPicker({
  products,
  value,
  onChange,
  error,
}: {
  products: OfferProductOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const [q, setQ] = useState("");
  const selected = new Set(value);
  const chosen = value.flatMap((id) => products.filter((p) => p.id === id));
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? products.filter((p) => p.name.toLowerCase().includes(t) || p.categoryName.toLowerCase().includes(t)) : products;
  }, [products, q]);

  const toggle = (id: string) => onChange(selected.has(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Products in this offer</h2>
          <p className="mt-1 text-xs text-mute">The customer chooses from these. Bought on their own, they stay at full price.</p>
        </div>
        <span className="shrink-0 text-xs text-gold-300 tabular-nums">{value.length} chosen</span>
      </div>

      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Chosen products">
          {chosen.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggle(p.id)}
                className="inline-flex max-w-56 items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/10 py-1 pr-2 pl-3 text-xs text-gold-200 hover:border-red-400/50 hover:text-red-200"
                aria-label={`Remove ${p.name}`}
              >
                <span className="truncate">{p.name}</span>
                <X className="size-3 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <span className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-mute" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products or collections"
          className={cn(inputClass, "pl-10")}
          aria-label="Search products"
        />
      </span>
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}

      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-600 py-8 text-center text-sm text-mute">Add products to the store first.</p>
      ) : (
        <ul className="max-h-[26rem] divide-y divide-ink-600/50 overflow-y-auto rounded-lg border border-ink-600/70">
          {matches.map((p) => {
            const on = selected.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-pressed={on}
                  className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors", on ? "bg-gold-500/8" : "hover:bg-ink-800")}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded border",
                      on ? "border-gold-400 bg-gold-500 text-ink-950" : "border-ink-500",
                    )}
                  >
                    {on && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span className="relative grid aspect-4/5 w-9 shrink-0 place-items-center overflow-hidden rounded bg-ink-900">
                    {p.image ? (
                      <Image src={p.image} alt="" fill sizes="36px" className="object-cover" />
                    ) : (
                      <Package className="size-4 text-mute" strokeWidth={1.3} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ivory">{p.name}</span>
                    <span className="block truncate text-xs text-mute">
                      {p.categoryName}
                      {p.variantCount > 0 && ` · ${p.variantCount} options`}
                    </span>
                  </span>
                  {!p.live && <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-mute">Not live</span>}
                  <span className="shrink-0 text-xs text-stone tabular-nums">{formatPrice(p.price)}</span>
                </button>
              </li>
            );
          })}
          {matches.length === 0 && <li className="py-8 text-center text-sm text-mute">No products match “{q}”.</li>}
        </ul>
      )}
    </div>
  );
}
