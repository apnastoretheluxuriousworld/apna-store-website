"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Shuffle } from "lucide-react";
import { Card } from "@/components/admin/ui";
import { ConfirmDialog, Field, FormActions, Switch, inputClass, selectClass } from "@/components/admin/form";
import { enqueue, pendingSave } from "@/components/admin/outbox";
import type { InfluencerOption } from "@/lib/data/coupons";
import { formatPrice } from "@/lib/format";
import { CODE_MAX, couponDiscount, couponFormSchema, generateCode, normalizeCode, type CouponRule } from "@/lib/validation/coupon";
import { cn } from "@/lib/utils";

export type CouponFormValues = {
  code: string;
  type: "percent" | "flat";
  value: string;
  maxDiscount: string;
  minOrder: string;
  maxUses: string;
  perCustomerLimit: string;
  firstOrderOnly: boolean;
  influencerId: string;
  note: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
};

export const EMPTY_COUPON: CouponFormValues = {
  code: "",
  type: "percent",
  value: "",
  maxDiscount: "",
  minOrder: "",
  maxUses: "",
  perCustomerLimit: "1",
  firstOrderOnly: false,
  influencerId: "",
  note: "",
  startsOn: "",
  endsOn: "",
  isActive: true,
};

const resolver = zodResolver(couponFormSchema) as unknown as Resolver<CouponFormValues>;

const num = (v: unknown) => (v == null || String(v).trim() === "" ? null : Number(v));

export function CouponForm({
  initial,
  influencers,
  takenCodes,
  stats,
  defaultInfluencerId = "",
}: {
  initial?: CouponFormValues & { id: string };
  influencers: InfluencerOption[];
  takenCodes: { id: string; code: string }[];
  /** Edit only: how the code has done so far. */
  stats?: { uses: number; sales: number; discountGiven: number };
  defaultInfluencerId?: string;
}) {
  const router = useRouter();
  const editing = !!initial;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<CouponFormValues>({ resolver, defaultValues: initial ?? { ...EMPTY_COUPON, influencerId: defaultInfluencerId } });
  const { register, control, handleSubmit, setValue, setError, formState } = form;
  const errors = formState.errors;
  const v = useWatch({ control }) as CouponFormValues;

  // Fresh server data (or a still-queued save, which is newer) — never over unsaved edits.
  useEffect(() => {
    if (!initial || form.formState.isDirty) return;
    const queued = pendingSave(initial.id)?.formValues as CouponFormValues | undefined;
    form.reset(queued ?? initial);
  }, [initial, form]);
  const showActions = !editing || formState.isDirty;

  const influencer = influencers.find((i) => i.id === v.influencerId);

  function generate() {
    const prefix = influencer ? (influencer.handle || influencer.name).split(/[\s._]/)[0] : "";
    let code = generateCode(prefix);
    for (let i = 0; i < 5 && takenCodes.some((t) => t.code === code); i++) code = generateCode(prefix);
    setValue("code", code, { shouldDirty: true, shouldValidate: true });
  }

  // Validated by the resolver; the raw form strings are what's queued (the server parses them again).
  function save() {
    const values = form.getValues();
    const id = initial?.id ?? crypto.randomUUID();
    const code = normalizeCode(values.code);
    if (takenCodes.some((t) => t.code === code && t.id !== id)) {
      setError("code", { message: "Another coupon already uses this code" });
      return;
    }
    const payload = { ...values, code, id };
    const inf = influencers.find((i) => i.id === values.influencerId);
    enqueue({
      kind: "coupon.save",
      entityId: id,
      label: code,
      payload,
      formValues: { ...values, code },
      editHref: `/admin/coupons/${id}`,
      preview: {
        id,
        code,
        type: values.type,
        value: Number(values.value),
        maxDiscount: values.type === "percent" ? num(values.maxDiscount) : null,
        minOrder: num(values.minOrder) ?? 0,
        maxUses: num(values.maxUses),
        perCustomerLimit: num(values.perCustomerLimit),
        firstOrderOnly: values.firstOrderOnly,
        influencerId: values.influencerId || null,
        influencerName: inf?.name ?? null,
        influencerOff: inf ? !inf.isActive : false,
        note: values.note,
        startsOn: values.startsOn,
        endsOn: values.endsOn,
        isActive: values.isActive,
      },
    });
    toast.success(editing ? "Coupon saved" : `Coupon ${code} created`);
    form.reset({ ...values, code });
    router.push("/admin/coupons");
  }
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => void handleSubmit(save)(e);

  function onDelete() {
    if (!initial) return;
    enqueue({ kind: "coupon.delete", entityId: initial.id, label: initial.code, payload: initial.id });
    toast.success("Coupon deleted");
    router.push("/admin/coupons");
  }

  const rule: CouponRule | null =
    Number(v.value) > 0
      ? { type: v.type, value: Number(v.value), maxDiscount: v.type === "percent" ? num(v.maxDiscount) : null, minOrder: num(v.minOrder) ?? 0 }
      : null;

  return (
    <form onSubmit={onSubmit} noValidate className={cn("space-y-3 lg:space-y-5 lg:pb-0", showActions && "pb-20")}>
      <div className="grid gap-3 lg:grid-cols-3 lg:gap-5">
        <div className="space-y-3 lg:col-span-2 lg:space-y-5">
          <Card className="space-y-4">
            <Field
              label="Coupon code"
              error={errors.code?.message}
              hint="What customers type at checkout · letters and numbers, e.g. RIYA10"
              htmlFor="code"
            >
              <div className="flex gap-2">
                <input
                  id="code"
                  maxLength={CODE_MAX}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  className={cn(inputClass, "font-mono tracking-wider uppercase")}
                  placeholder="RIYA10"
                  aria-invalid={!!errors.code}
                  {...register("code", { setValueAs: (x: string) => normalizeCode(x ?? "") })}
                />
                <button
                  type="button"
                  onClick={generate}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-ink-600 px-3 text-xs text-stone hover:border-gold-500/50 hover:text-gold-300"
                >
                  <Shuffle className="size-3.5" /> Generate
                </button>
              </div>
            </Field>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Discount</h2>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Discount type">
                  {(
                    [
                      ["percent", "Percentage", "e.g. 10% off"],
                      ["flat", "Fixed amount", "e.g. ₹1,500 off"],
                    ] as const
                  ).map(([key, title, sub]) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={field.value === key}
                      onClick={() => field.onChange(key)}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-left",
                        field.value === key ? "border-gold-500/60 bg-gold-500/10" : "border-ink-600 hover:border-ink-500",
                      )}
                    >
                      <span className={cn("block text-sm", field.value === key ? "text-gold-300" : "text-ivory")}>{title}</span>
                      <span className="block text-xs text-mute">{sub}</span>
                    </button>
                  ))}
                </div>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={v.type === "percent" ? "Discount %" : "Discount ₹"} error={errors.value?.message} htmlFor="value">
                <Affix affix={v.type === "percent" ? "%" : "₹"} side={v.type === "percent" ? "right" : "left"}>
                  <input
                    id="value"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={v.type === "percent" ? 100 : undefined}
                    className={cn(inputClass, v.type === "flat" && "pl-8")}
                    placeholder={v.type === "percent" ? "10" : "1500"}
                    aria-invalid={!!errors.value}
                    {...register("value")}
                  />
                </Affix>
              </Field>
              {v.type === "percent" && (
                <Field label="Maximum discount" error={errors.maxDiscount?.message} hint="Optional cap, e.g. 10% off but at most ₹3,000" htmlFor="maxDiscount">
                  <Affix affix="₹">
                    <input
                      id="maxDiscount"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      className={cn(inputClass, "pl-8")}
                      placeholder="No cap"
                      aria-invalid={!!errors.maxDiscount}
                      {...register("maxDiscount")}
                    />
                  </Affix>
                </Field>
              )}
              <Field label="Minimum order" error={errors.minOrder?.message} hint="Bag total needed to use the code · blank = any amount" htmlFor="minOrder">
                <Affix affix="₹">
                  <input
                    id="minOrder"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className={cn(inputClass, "pl-8")}
                    placeholder="0"
                    aria-invalid={!!errors.minOrder}
                    {...register("minOrder")}
                  />
                </Affix>
              </Field>
            </div>
            {rule && <Examples rule={rule} />}
          </Card>

          <Card className="space-y-4">
            <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Limits</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Total uses" error={errors.maxUses?.message} hint="All customers together · blank = unlimited" htmlFor="maxUses">
                <input
                  id="maxUses"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className={inputClass}
                  placeholder="Unlimited"
                  aria-invalid={!!errors.maxUses}
                  {...register("maxUses")}
                />
              </Field>
              <Field
                label="Uses per customer"
                error={errors.perCustomerLimit?.message}
                hint="Matched by mobile number · blank = unlimited"
                htmlFor="perCustomerLimit"
              >
                <input
                  id="perCustomerLimit"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className={inputClass}
                  placeholder="Unlimited"
                  aria-invalid={!!errors.perCustomerLimit}
                  {...register("perCustomerLimit")}
                />
              </Field>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-ink-600/70 px-3.5 py-3">
              <div>
                <p className="text-sm text-ivory">First order only</p>
                <p className="text-xs text-mute">Only for mobile numbers that haven&apos;t ordered before.</p>
              </div>
              <Controller
                control={control}
                name="firstOrderOnly"
                render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="First order only" />}
              />
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">Valid dates</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts on" error={errors.startsOn?.message} hint="Blank = right away" htmlFor="startsOn">
                <input id="startsOn" type="date" className={cn(inputClass, "scheme-dark")} {...register("startsOn")} />
              </Field>
              <Field label="Ends on" error={errors.endsOn?.message} hint="Works until midnight that day · blank = never ends" htmlFor="endsOn">
                <input id="endsOn" type="date" className={cn(inputClass, "scheme-dark")} aria-invalid={!!errors.endsOn} {...register("endsOn")} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-3 lg:space-y-5">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ivory">Coupon on</p>
                <p className="text-xs text-mute">Switch off to stop it at once (e.g. if it leaks).</p>
              </div>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Coupon on" />}
              />
            </div>
          </Card>

          <Card className="space-y-4">
            <Field
              label="Influencer"
              htmlFor="influencerId"
              hint={
                influencer ? (
                  influencer.commissionPercent > 0 ? (
                    `Earns ${influencer.commissionPercent}% commission on delivered orders with this code`
                  ) : (
                    "Sales with this code are tracked on their page"
                  )
                ) : (
                  <>
                    Optional · tracks their sales and commission.{" "}
                    <Link href="/admin/influencers/new" className="text-gold-400 hover:underline">
                      Add an influencer
                    </Link>
                  </>
                )
              }
            >
              <select id="influencerId" className={cn(selectClass, !v.influencerId && "text-mute")} {...register("influencerId")}>
                <option value="">None (store coupon)</option>
                {influencers.map((i) => (
                  <option key={i.id} value={i.id} className="text-ivory">
                    {i.name}
                    {i.handle ? ` (@${i.handle})` : ""}
                    {i.isActive ? "" : " — off"}
                  </option>
                ))}
              </select>
            </Field>
            {influencer && !influencer.isActive && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                This influencer is switched off, so their codes don&apos;t work at checkout.
              </p>
            )}
            <Field label="Note" error={errors.note?.message} hint="Only you see this" htmlFor="note">
              <textarea
                id="note"
                rows={3}
                maxLength={300}
                className={cn(inputClass, "h-auto py-3 leading-relaxed")}
                placeholder="Diwali reel, 3 Nov"
                {...register("note")}
              />
            </Field>
          </Card>

          {stats && (
            <Card>
              <h2 className="mb-3 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">So far</h2>
              <dl className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Orders" value={String(stats.uses)} />
                <Stat label="Sales" value={formatPrice(stats.sales)} />
                <Stat label="Discount" value={formatPrice(stats.discountGiven)} />
              </dl>
              <p className="mt-3 text-[0.7rem] text-mute">Cancelled orders don&apos;t count, and their use goes back to the code.</p>
            </Card>
          )}
        </div>
      </div>

      {editing && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-red-500/20">
          <div>
            <p className="text-sm text-ivory">Delete coupon</p>
            <p className="text-xs text-mute">
              {stats?.uses ? "It's on orders, so it can't be deleted. Switch it off instead." : "Removes the code permanently."}
            </p>
          </div>
          <button
            type="button"
            disabled={!!stats?.uses}
            onClick={() => setConfirmDelete(true)}
            className="h-10 rounded-lg border border-red-500/40 px-4 text-sm text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete
          </button>
        </Card>
      )}

      {showActions && <FormActions cancelHref="/admin/coupons" saving={false} label={editing ? "Save changes" : "Create coupon"} />}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this coupon?"
        body={<>Customers won&apos;t be able to use “{initial?.code}” any more.</>}
        pending={false}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}

function Affix({ affix, side = "left", children }: { affix: string; side?: "left" | "right"; children: React.ReactNode }) {
  return (
    <span className="relative block">
      {children}
      <span className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm text-mute", side === "left" ? "left-3.5" : "right-9")}>
        {affix}
      </span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-900 px-2 py-2.5">
      <dd className="truncate text-sm text-ivory tabular-nums">{value}</dd>
      <dt className="mt-0.5 text-[0.6rem] uppercase tracking-wider text-mute">{label}</dt>
    </div>
  );
}

/** "What the customer gets" on a few bag sizes, so the admin can see the cap and minimum at work. */
function Examples({ rule }: { rule: CouponRule }) {
  const base = Math.max(rule.minOrder, 1000);
  const bags = [...new Set([Math.max(0, rule.minOrder - 1000), base, base * 3, base * 10].filter((n) => n > 0))].slice(0, 4);
  return (
    <div className="rounded-lg bg-ink-900 px-3.5 py-3">
      <p className="mb-2 text-[0.6rem] uppercase tracking-[0.2em] text-mute">What the customer gets</p>
      <ul className="space-y-1 text-xs">
        {bags.map((b) => {
          const off = couponDiscount(rule, b);
          return (
            <li key={b} className="flex justify-between gap-3 tabular-nums">
              <span className="text-stone">Bag of {formatPrice(b)}</span>
              <span className={off ? "text-emerald-300" : "text-mute"}>{off ? `−${formatPrice(off)} → pays ${formatPrice(b - off)}` : "below minimum"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
