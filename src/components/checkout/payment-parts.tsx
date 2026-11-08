"use client";

import { useRef, useState } from "react";
import { Check, Copy, ImagePlus, Loader2, RefreshCw, Smartphone } from "lucide-react";
import { getProofUploadUrl } from "@/app/(store)/checkout/actions";
import { formatPrice } from "@/lib/format";
import { prepareImage, putWithProgress } from "@/lib/upload-client";
import { upiPayLink, type CheckoutSettings } from "@/lib/validation/checkout";
import { cn } from "@/lib/utils";
import { storeInputClass } from "@/components/account/fields";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: the text is selectable anyway */
        }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-ink-600 px-2 py-1 text-[0.65rem] uppercase tracking-[0.14em] text-stone hover:border-gold-500/40 hover:text-gold-300"
      aria-label={label}
    >
      {done ? <Check className="size-3 text-emerald-300" /> : <Copy className="size-3" />} {done ? "Copied" : "Copy"}
    </button>
  );
}

/** The store's QR, the exact amount, and how to pay. */
export function UpiPayPanel({ settings, amount }: { settings: CheckoutSettings; amount: number }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-gold-500/25 bg-ink-900 p-4 sm:flex-row sm:items-start">
        <div className="w-full max-w-56 shrink-0 overflow-hidden rounded-lg bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- the store's own QR, shown pixel-exact for scanning */}
          <img src={settings.qrUrl} alt="Store UPI QR code" className="aspect-square w-full object-contain" />
        </div>
        <div className="w-full min-w-0 space-y-3 text-center sm:text-left">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-stone">Pay exactly</p>
            <p className="flex items-center justify-center gap-2 font-serif text-4xl text-gold-300 tabular-nums sm:justify-start">
              {formatPrice(amount)} <CopyButton text={String(amount)} label="Copy amount" />
            </p>
          </div>
          {settings.payeeName && <p className="text-xs text-stone">To: <span className="text-ivory">{settings.payeeName}</span></p>}
          {settings.upiId && (
            <p className="flex flex-wrap items-center justify-center gap-2 text-xs text-stone sm:justify-start">
              UPI ID: <span className="font-mono text-ivory select-all">{settings.upiId}</span>
              <CopyButton text={settings.upiId} label="Copy UPI ID" />
            </p>
          )}
          {settings.upiId && (
            <a
              href={upiPayLink(settings, amount)}
              className="hidden w-full items-center justify-center gap-2 rounded-md border border-gold-500/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold-300 hover:bg-gold-500/10 pointer-coarse:inline-flex"
            >
              <Smartphone className="size-4" /> Open UPI app
            </a>
          )}
        </div>
      </div>
      <ol className="space-y-1.5 text-xs leading-relaxed text-stone">
        <li>
          <span className="text-gold-400">1.</span> Scan the QR with any UPI app (GPay, PhonePe, Paytm, BHIM…) and pay{" "}
          <span className="text-ivory">{formatPrice(amount)}</span>.
          <span className="block pl-3.5 text-mute">On this phone? Take a screenshot of the QR, then in your UPI app choose “Scan” → “Upload from gallery”.</span>
        </li>
        <li>
          <span className="text-gold-400">2.</span> Take a screenshot of the “Payment successful” screen.
        </li>
        <li>
          <span className="text-gold-400">3.</span> Upload it below and place your order. We’ll confirm it as soon as we’ve checked the payment.
        </li>
      </ol>
    </div>
  );
}

export type ProofValue = { url: string | null; reference: string };

/** Pick a screenshot → shrink it → upload straight to storage. */
export function ProofUpload({
  value,
  onChange,
  error,
}: {
  value: ProofValue;
  onChange: (v: ProofValue) => void;
  error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose a screenshot or photo.");
      return;
    }
    setProgress(0);
    try {
      const blob = await prepareImage(file, 2000);
      const res = await getProofUploadUrl({ contentType: blob.type, size: blob.size });
      if (!res.ok) throw new Error(res.error);
      await putWithProgress(res.data.uploadUrl, blob, setProgress);
      onChange({ ...value, url: res.data.publicUrl });
    } catch (e) {
      setUploadError(e instanceof Error && !e.message.includes("CORS") ? e.message : "Upload failed. Please check your connection and try again.");
    } finally {
      setProgress(null);
    }
  }

  const shownError = uploadError ?? error;

  return (
    <div className="space-y-3">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Payment screenshot"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f);
        }}
      />
      {value.url ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.url} alt="Your payment screenshot" className="h-20 w-14 shrink-0 rounded-md border border-ink-600 object-cover" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm text-emerald-200">
              <Check className="size-4" /> Screenshot added
            </p>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={progress !== null}
              className="mt-1 inline-flex items-center gap-1.5 text-xs text-stone underline-offset-2 hover:text-gold-300 hover:underline"
            >
              <RefreshCw className="size-3" /> Change
            </button>
          </div>
          {progress !== null && <Loader2 className="size-4 animate-spin text-gold-400" />}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={progress !== null}
          aria-describedby={shownError ? "proof-error" : undefined}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-7 text-center transition-colors",
            shownError ? "border-red-400/60 bg-red-500/5" : "border-gold-500/40 bg-gold-500/5 hover:border-gold-400 hover:bg-gold-500/10",
          )}
        >
          {progress !== null ? (
            <>
              <Loader2 className="size-6 animate-spin text-gold-400" />
              <span className="text-xs text-gold-300">Uploading… {progress}%</span>
            </>
          ) : (
            <>
              <ImagePlus className="size-7 text-gold-400" strokeWidth={1.3} />
              <span className="text-sm text-ivory">Upload payment screenshot</span>
              <span className="text-xs text-mute">From your gallery · JPG, PNG or WebP</span>
            </>
          )}
        </button>
      )}
      {shownError && (
        <p id="proof-error" role="alert" className="text-xs text-red-400">
          {shownError}
        </p>
      )}
      <div>
        <label htmlFor="utr" className="mb-1.5 block text-[0.65rem] uppercase tracking-[0.2em] text-stone">
          UPI transaction ID / UTR <span className="normal-case tracking-normal text-mute">(optional)</span>
        </label>
        <input
          id="utr"
          inputMode="text"
          autoComplete="off"
          maxLength={40}
          value={value.reference}
          onChange={(e) => onChange({ ...value, reference: e.target.value.replace(/\s/g, "") })}
          placeholder="e.g. 431245678901"
          className={cn(storeInputClass, "px-4 font-mono tracking-wide")}
        />
        <p className="mt-1.5 text-xs text-mute">Helps us find your payment faster. It’s on the payment receipt in your UPI app.</p>
      </div>
    </div>
  );
}
