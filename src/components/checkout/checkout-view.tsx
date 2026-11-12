"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, use, useEffect, useState, useTransition } from "react";
import { AlertCircle, Banknote, Gift, Loader2, Lock, QrCode, ShoppingBag } from "lucide-react";
import { placeOrder, type AppliedCoupon } from "@/app/(store)/checkout/actions";
import { FieldError, storeInputClass } from "@/components/account/fields";
import { clearCart } from "@/components/cart/cart-store";
import { CartSkeleton } from "@/components/ui/skeleton";
import { useCartQuote } from "@/components/cart/use-cart-quote";
import { Button, ButtonLink } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { zodFieldErrors } from "@/lib/actions";
import { INDIAN_STATES, addressSchema, codBlockReason, computeTotals, placeOrderSchema, type AddressInput } from "@/lib/validation/checkout";
import { couponDiscount } from "@/lib/validation/coupon";
import { cn } from "@/lib/utils";
import { CouponBox } from "./coupon-box";
import { ProofUpload, UpiPayPanel, type ProofValue } from "./payment-parts";

/** Form values while typing (state may still be unchosen). */
export type AddressDraft = Omit<AddressInput, "state" | "line2" | "landmark"> & { state: string; line2: string; landmark: string };

export type CheckoutPrefill = {
  signedIn: boolean;
  address: AddressDraft;
};

type Method = "upi" | "cod";

const omit = (o: Record<string, string>, key: string) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key));

function Label({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[0.65rem] uppercase tracking-[0.2em] text-stone">
      {children}
      {optional && <span className="ml-1 normal-case tracking-normal text-mute">(optional)</span>}
    </label>
  );
}

function Step({ n, title, children, aside }: { n: number; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink-600/80 bg-ink-850 p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 font-serif text-2xl text-ivory">
          <span className="grid size-7 place-items-center rounded-full border border-gold-500/50 font-sans text-xs text-gold-300">{n}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * Opens at once with an empty form (the bag lives in this browser); the signed-in
 * customer's name, mobile and saved address stream in and fill it — unless they
 * have already started typing.
 */
export function CheckoutView({ prefill: prefillPromise }: { prefill: Promise<CheckoutPrefill> }) {
  const [prefill, setPrefill] = useState<CheckoutPrefill | null>(null);
  return (
    <>
      <Suspense fallback={null}>
        <ResolvePrefill promise={prefillPromise} onReady={setPrefill} />
      </Suspense>
      <CheckoutForm prefill={prefill} />
    </>
  );
}

function ResolvePrefill({ promise, onReady }: { promise: Promise<CheckoutPrefill>; onReady: (p: CheckoutPrefill) => void }) {
  const value = use(promise);
  useEffect(() => onReady(value), [value, onReady]);
  return null;
}

const BLANK_ADDRESS: AddressDraft = { fullName: "", phone: "", line1: "", line2: "", landmark: "", city: "", state: "", pincode: "" };

function CheckoutForm({ prefill }: { prefill: CheckoutPrefill | null }) {
  const router = useRouter();
  const bag = useCartQuote();
  const { lines, bundles, settings, hasIssues } = bag;
  const signedIn = prefill?.signedIn ?? false;

  const [address, setAddress] = useState<AddressDraft>(BLANK_ADDRESS);
  // Fill in the saved details when they arrive, if nothing has been typed yet.
  const [applied, setApplied] = useState<CheckoutPrefill | null>(null);
  if (prefill && prefill !== applied) {
    setApplied(prefill);
    if (Object.values(address).every((v) => !v)) setAddress(prefill.address);
  }
  const [notes, setNotes] = useState("");
  const [saveAddress, setSaveAddress] = useState(true);
  const [method, setMethod] = useState<Method | null>(null);
  const [proof, setProof] = useState<ProofValue>({ url: null, reference: "" });
  const [codConsent, setCodConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [placing, startPlacing] = useTransition();
  const [placed, setPlaced] = useState(false);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  if (placed) return <CartSkeleton />;
  if (!bag.ready || (bag.loading && lines.length === 0 && bundles.length === 0 && !bag.empty)) return <CartSkeleton />;

  if (bag.empty) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
        <ShoppingBag className="size-10 text-gold-400" strokeWidth={1.1} />
        <p className="mt-5 font-serif text-3xl text-ivory">Your cart is empty</p>
        <ButtonLink href="/shop" className="mt-8">
          Explore the collection
        </ButtonLink>
      </div>
    );
  }

  // The coupon is worked out again here as the bag changes (the server re-checks it on Place order).
  // It only ever applies to the regular items: offers already have their own price.
  const subtotal = bag.totals.subtotal;
  const itemsSubtotal = bag.itemsSubtotal;
  const discount = coupon ? couponDiscount(coupon.rule, itemsSubtotal) : 0;
  const belowMinimum =
    coupon && itemsSubtotal < coupon.rule.minOrder
      ? `Add ${formatPrice(coupon.rule.minOrder - itemsSubtotal)} more to use this code (minimum order ${formatPrice(coupon.rule.minOrder)}, offers not included).`
      : null;
  // COD's minimum is judged on what the customer pays (after the discount, before the COD charge).
  const codBlocked = settings ? codBlockReason(computeTotals(subtotal, settings, null, discount).total, settings) : null;

  const upiOn = !!settings?.upiEnabled;
  const codOn = !codBlocked;
  // Fall back to the only available method.
  const chosen: Method | null = method ?? (upiOn && !codOn ? "upi" : !upiOn && codOn ? "cod" : null);
  // The COD charge joins the total once cash on delivery is picked.
  const totals = settings ? computeTotals(subtotal, settings, chosen, discount) : { ...bag.totals, discount: 0 };
  const codFee = settings?.codFee ?? 0;
  const returnFee = settings?.returnFee ?? 0;

  const set = (k: keyof AddressDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAddress((a) => ({ ...a, [k]: e.target.value }));
    if (errors[`address.${k}`]) setErrors((all) => omit(all, `address.${k}`));
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!chosen) {
      const a = addressSchema.safeParse(address);
      const fe = a.success ? {} : Object.fromEntries(Object.entries(zodFieldErrors(a.error)).map(([k, m]) => [`address.${k}`, m]));
      setErrors({ ...fe, paymentMethod: "Choose how you'd like to pay" });
      const first = Object.keys(fe)[0]?.slice(8);
      document.getElementById(first ?? "payment")?.scrollIntoView({ behavior: "smooth", block: first ? "center" : "start" });
      return;
    }
    const input =
      chosen === "upi"
        ? {
            paymentMethod: "upi" as const,
            items: bag.items,
            bundles: bag.bundleItems,
            address,
            notes,
            saveAddress,
            couponCode: coupon && discount > 0 ? coupon.code : "",
            proofUrl: proof.url ?? "",
            reference: proof.reference,
          }
        : { paymentMethod: "cod" as const, items: bag.items, bundles: bag.bundleItems, address, notes, saveAddress, couponCode: coupon && discount > 0 ? coupon.code : "", codConsent };
    const parsed = placeOrderSchema.safeParse(input);
    if (!parsed.success) {
      const fe = zodFieldErrors(parsed.error);
      setErrors(fe);
      const first = Object.keys(fe)[0];
      const id = first?.startsWith("address.") ? first.slice(8) : first === "proofUrl" || first === "codConsent" ? "payment" : null;
      if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors({});
    startPlacing(async () => {
      const res = await placeOrder(input);
      if (res.ok) {
        setPlaced(true);
        clearCart();
        router.replace(`/order/${res.token}?placed=1`);
        return;
      }
      if (res.couponRejected) {
        // The code stopped working (expired, used up, already used on this number): drop it.
        setCoupon(null);
        setCouponError(res.fieldErrors?.couponCode ?? res.error);
        setFormError("Your coupon couldn't be applied, so the total has changed. Please check it and place the order again.");
        return;
      }
      setErrors(res.fieldErrors ?? {});
      setFormError(res.error);
      if (res.lines) void bag.refresh();
    });
  }

  const err = (k: string) => errors[`address.${k}`];
  const field = (k: keyof AddressDraft, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, optional = false) => (
    <div className={props.className}>
      <Label htmlFor={k} optional={optional}>
        {label}
      </Label>
      <input
        id={k}
        value={(address[k] as string) ?? ""}
        onChange={set(k)}
        aria-invalid={!!err(k) || undefined}
        aria-describedby={err(k) ? `${k}-error` : undefined}
        {...props}
        className={cn(storeInputClass, "px-4")}
      />
      <FieldError id={`${k}-error`} message={err(k)} />
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-10">
      <div className="space-y-4">
        <Step
          n={1}
          title="Delivery details"
          aside={
            !signedIn && (
              <Link href="/account/login?next=/checkout" className="text-xs text-gold-400 hover:text-gold-300">
                Sign in
              </Link>
            )
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {field("fullName", "Full name", { autoComplete: "name", autoCapitalize: "words", maxLength: 60 })}
            <div>
              <Label htmlFor="phone">Mobile number</Label>
              <span className="relative block">
                <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[0.95rem] text-stone">+91</span>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={address.phone}
                  onChange={(e) => {
                    let d = e.target.value.replace(/\D/g, "");
                    if (d.length > 10 && (d.startsWith("0") || d.startsWith("91"))) d = d.slice(d.startsWith("0") ? 1 : 2);
                    setAddress((a) => ({ ...a, phone: d.slice(0, 10) }));
                  }}
                  aria-invalid={!!err("phone") || undefined}
                  placeholder="9876543210"
                  className={cn(storeInputClass, "pr-4 pl-13 tracking-wide")}
                />
              </span>
              <FieldError id="phone-error" message={err("phone")} />
            </div>
            {field("line1", "House / flat, street", { autoComplete: "address-line1", maxLength: 120, className: "sm:col-span-2" })}
            {field("line2", "Area / locality", { autoComplete: "address-line2", maxLength: 120 }, true)}
            {field("landmark", "Landmark", { maxLength: 80 }, true)}
            {field("city", "City / town", { autoComplete: "address-level2", maxLength: 60 })}
            {field("pincode", "PIN code", { inputMode: "numeric", autoComplete: "postal-code", maxLength: 6 })}
            <div className="sm:col-span-2">
              <Label htmlFor="state">State</Label>
              <select
                id="state"
                value={address.state ?? ""}
                onChange={set("state")}
                aria-invalid={!!err("state") || undefined}
                className={cn(storeInputClass, "select-chevron px-4", !address.state && "text-mute")}
              >
                <option value="" disabled>
                  Choose your state
                </option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s} className="text-ivory">
                    {s}
                  </option>
                ))}
              </select>
              <FieldError id="state-error" message={err("state")} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes" optional>
                Note for the store
              </Label>
              <textarea
                id="notes"
                rows={2}
                maxLength={300}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Gift wrap, delivery timing…"
                className={cn(storeInputClass, "h-auto px-4 py-3 leading-relaxed")}
              />
            </div>
          </div>
          {signedIn && (
            <label className="mt-4 flex items-center gap-2.5 text-xs text-stone">
              <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="size-4 accent-gold-500" />
              Save this address to my account
            </label>
          )}
        </Step>

        <div id="payment" className="scroll-mt-28">
          <Step n={2} title="Payment">
            {!upiOn && !codOn ? (
              <p className="rounded-lg bg-red-500/10 px-3 py-3 text-sm text-red-200">
                Online ordering is paused right now{codBlocked ? ` — ${codBlocked.toLowerCase()}` : ""}. Please call or WhatsApp the store to order.
              </p>
            ) : (
              <div className="space-y-3" role="radiogroup" aria-label="Payment method">
                {upiOn && (
                  <MethodCard
                    selected={chosen === "upi"}
                    onSelect={() => {
                      setMethod("upi");
                      setErrors({});
                    }}
                    icon={QrCode}
                    title="Pay by UPI"
                    sub="Scan the QR, pay, upload the screenshot"
                  >
                    <UpiPayPanel settings={settings!} amount={totals.total} />
                    <div className="mt-5">
                      <ProofUpload
                        value={proof}
                        onChange={(v) => {
                          setProof(v);
                          if (v.url) setErrors((all) => omit(all, "proofUrl"));
                        }}
                        error={errors.proofUrl}
                      />
                    </div>
                  </MethodCard>
                )}
                <MethodCard
                  selected={chosen === "cod"}
                  disabled={!codOn}
                  onSelect={() => {
                    setMethod("cod");
                    setErrors({});
                  }}
                  icon={Banknote}
                  title="Cash on delivery"
                  sub={codBlocked ?? (codFee ? `Pay in cash when it arrives · ${formatPrice(codFee)} COD charge` : "Pay in cash when your order arrives")}
                >
                  <label className={cn("flex items-start gap-3 rounded-xl border p-3.5", errors.codConsent ? "border-red-400/60 bg-red-500/5" : "border-gold-500/25 bg-gold-500/5")}>
                    <input
                      type="checkbox"
                      checked={codConsent}
                      onChange={(e) => {
                        setCodConsent(e.target.checked);
                        setErrors((all) => omit(all, "codConsent"));
                      }}
                      className="mt-0.5 size-4 shrink-0 accent-gold-500"
                    />
                    <span className="text-sm leading-relaxed text-ivory">
                      I confirm this order and will pay <span className="font-semibold text-gold-300">{formatPrice(totals.total)}</span> in cash when it
                      is delivered to the address above.
                      <span className="mt-1 block text-xs text-stone">
                        Our team may call you on +91 {address.phone || "your number"} to confirm before dispatch.
                      </span>
                    </span>
                  </label>
                  {errors.codConsent && (
                    <p role="alert" className="mt-2 text-xs text-red-400">
                      {errors.codConsent}
                    </p>
                  )}
                </MethodCard>
                {errors.paymentMethod && (
                  <p role="alert" className="text-xs text-red-400">
                    {errors.paymentMethod}
                  </p>
                )}
              </div>
            )}
          </Step>
        </div>
      </div>

      <aside className="h-fit space-y-4 lg:sticky lg:top-32">
        <div className="rounded-2xl border border-gold-500/20 bg-ink-850 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="eyebrow">Your order</h2>
            <Link href="/cart" className="text-xs text-stone hover:text-gold-300">
              Edit cart
            </Link>
          </div>
          <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {bundles.map((b) => (
              <li key={`offer:${b.id}`} className="rounded-lg border border-gold-500/25 bg-gold-500/5 p-2.5">
                <span className="flex items-center gap-2">
                  <Gift className="size-3.5 shrink-0 text-gold-400" strokeWidth={1.6} />
                  <span className="min-w-0 flex-1 truncate text-xs text-ivory">{b.title}</span>
                  <span className="text-xs text-ivory tabular-nums">{formatPrice(b.price)}</span>
                </span>
                <span className="mt-1 block pl-5.5 text-[0.7rem] leading-relaxed text-stone">
                  {b.picks.map((p) => (p.variantLabel ? `${p.name} (${p.variantLabel})` : p.name)).join(" · ")}
                </span>
                {b.issue && <span className="mt-1 block pl-5.5 text-[0.7rem] text-red-300">{b.issue}</span>}
              </li>
            ))}
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-3">
                <span className="relative aspect-4/5 w-12 shrink-0 overflow-hidden rounded-md bg-ink-900">
                  {l.image && <Image src={l.image} alt="" fill sizes="48px" className="object-cover" />}
                  <span className="bg-gold absolute top-0.5 right-0.5 grid size-4 place-items-center rounded-full text-[0.55rem] font-semibold text-ink-950">
                    {l.quantity}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-ivory">{l.name}</span>
                  {l.variantLabel && <span className="block text-[0.7rem] text-stone">{l.variantLabel}</span>}
                  {l.issue && <span className="block text-[0.7rem] text-red-300">{l.issue}</span>}
                </span>
                <span className="text-xs text-ivory tabular-nums">{formatPrice(l.unitPrice * l.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-ink-600/70 pt-4 text-sm">
            <div className="flex justify-between text-stone">
              <dt>Subtotal</dt>
              <dd className="text-ivory tabular-nums">{formatPrice(totals.subtotal)}</dd>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-emerald-300">
                <dt>Coupon {coupon?.code}</dt>
                <dd className="tabular-nums">−{formatPrice(totals.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between text-stone">
              <dt>Shipping</dt>
              <dd className="tabular-nums">{totals.shippingFee ? formatPrice(totals.shippingFee) : <span className="text-emerald-300">Free</span>}</dd>
            </div>
            {totals.codFee > 0 && (
              <div className="flex justify-between text-stone">
                <dt>Cash on delivery charge</dt>
                <dd className="text-ivory tabular-nums">{formatPrice(totals.codFee)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-1">
              <dt className="text-ivory">Total</dt>
              <dd className="font-serif text-2xl text-gold-300 tabular-nums">{formatPrice(totals.total)}</dd>
            </div>
          </dl>
          {itemsSubtotal > 0 ? (
          <CouponBox
            items={bag.items}
            phone={address.phone}
            applied={coupon}
            onApplied={(c) => {
              setCoupon(c);
              setFormError(null);
            }}
            error={couponError}
            onError={setCouponError}
            belowMinimum={belowMinimum}
          />
          ) : (
            <p className="mt-4 rounded-lg bg-ink-900 px-3 py-2 text-xs text-stone">Coupons don&apos;t apply to offers.</p>
          )}
          {itemsSubtotal > 0 && bundles.length > 0 && (
            <p className="mt-2 text-[0.7rem] text-mute">Coupons apply to the regular items only, not to offers.</p>
          )}
          {totals.discount > 0 && (
            <p className="mt-2 text-center text-xs text-emerald-300">You save {formatPrice(totals.discount)} on this order</p>
          )}
          {returnFee > 0 && (
            <p className="mt-3 rounded-lg bg-ink-900 px-3 py-2 text-xs leading-relaxed text-stone">
              Returns: a <span className="text-ivory">{formatPrice(returnFee)}</span> return charge applies if you send this order back.{" "}
              <Link href="/refund-policy" className="text-gold-400 hover:text-gold-300">
                Return policy
              </Link>
            </p>
          )}

          {(formError || hasIssues) && (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-200">
              <AlertCircle className="mt-px size-3.5 shrink-0" />
              <span>
                {formError ?? "Some items in your cart changed."}{" "}
                {hasIssues && (
                  <Link href="/cart" className="underline underline-offset-2">
                    Review cart
                  </Link>
                )}
              </span>
            </p>
          )}

          <Button type="submit" size="lg" className="mt-5 w-full" disabled={placing || hasIssues || bag.loading || (!upiOn && !codOn)}>
            {placing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Lock className="size-3.5" /> Place order · {formatPrice(totals.total)}
              </>
            )}
          </Button>
          <p className="mt-3 text-center text-[0.68rem] leading-relaxed text-mute">
            By placing your order you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-gold-300">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/refund-policy" className="underline underline-offset-2 hover:text-gold-300">
              Refund policy
            </Link>
            .
          </p>
        </div>
      </aside>
    </form>
  );
}

function MethodCard({
  selected,
  disabled,
  onSelect,
  icon: Icon,
  title,
  sub,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  icon: typeof QrCode;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        selected ? "border-gold-500/60 bg-ink-900/60" : "border-ink-600",
        disabled && "opacity-50",
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled}
        onClick={onSelect}
        className="flex w-full items-center gap-3 p-4 text-left disabled:cursor-not-allowed"
      >
        <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", selected ? "border-gold-400" : "border-ink-600")}>
          {selected && <span className="bg-gold size-2.5 rounded-full" />}
        </span>
        <Icon className="size-5 shrink-0 text-gold-400" strokeWidth={1.4} />
        <span className="min-w-0">
          <span className="block text-sm text-ivory">{title}</span>
          <span className="block text-xs text-stone">{sub}</span>
        </span>
      </button>
      {selected && !disabled && <div className="border-t border-ink-600/70 p-4">{children}</div>}
    </div>
  );
}
