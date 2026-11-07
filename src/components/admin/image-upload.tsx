"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, Link2, Loader2, Trash2, UploadCloud } from "lucide-react";
import { discardUpload, getUploadUrl } from "@/app/admin/(panel)/upload-actions";
import { inputClass } from "./form";
import { cn } from "@/lib/utils";

/**
 * Downscale + convert to WebP in the browser before upload: a 6 MB phone
 * photo becomes ~200 KB, so uploads are fast and storage stays small.
 */
async function prepareImage(file: File, maxSide = 1600): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
  return blob && blob.size < file.size ? blob : file;
}

export function putWithProgress(url: string, body: Blob, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", body.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload blocked — check the bucket's CORS policy (SETUP.md §2)."));
    xhr.send(body);
  });
}

export type UploadFolder = "categories" | "products" | "hero" | "reels" | "testimonials" | "reviews";

/** Resize (photos only; videos go as-is) → presign → PUT straight to the bucket. Returns the public URL. */
export async function uploadImage(file: File, folder: UploadFolder, onProgress: (pct: number) => void) {
  const blob = await prepareImage(file);
  const res = await getUploadUrl({ folder, contentType: blob.type, size: blob.size });
  if (!res.ok) throw new Error(res.error);
  await putWithProgress(res.data.uploadUrl, blob, onProgress);
  return res.data.publicUrl;
}

export function ImageUpload({
  value,
  onChange,
  folder,
  aspect = "aspect-4/5",
  label = "Image",
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  folder: UploadFolder;
  aspect?: string;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urlMode, setUrlMode] = useState(false);
  // Files uploaded during this visit. If one is replaced/removed before saving, nothing
  // will ever reference it, so delete it from the bucket straight away. (A previously
  // saved image is deleted by the server when the form is saved, so Cancel still works.)
  const uploadedHere = useRef(new Set<string>());

  function change(next: string | null) {
    if (value && value !== next && uploadedHere.current.delete(value)) void discardUpload(value);
    onChange(next);
  }

  async function upload(file: File) {
    setError(null);
    setProgress(0);
    try {
      const url = await uploadImage(file, folder, setProgress);
      uploadedHere.current.add(url);
      change(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "group relative mx-auto w-full max-w-56 overflow-hidden rounded-xl border border-dashed bg-ink-900",
          aspect,
          value ? "border-ink-600" : "border-gold-500/30",
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) upload(f);
        }}
      >
        {/* Eager: the preview is the main visual near the top of the form (Next flags it as the LCP image otherwise). */}
        {value ? (
          <Image src={value} alt={label} fill unoptimized loading="eager" className="object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-mute transition-colors hover:text-gold-300"
          >
            <ImagePlus className="size-7" strokeWidth={1.25} />
            <span className="px-4 text-center text-xs">Click or drop an image</span>
          </button>
        )}
        {progress !== null && (
          <div className="absolute inset-0 grid place-items-center bg-ink-950/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-xs text-gold-300">
              <Loader2 className="size-5 animate-spin" />
              {progress}%
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={progress !== null}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-ink-600 px-3 text-xs text-stone hover:border-gold-500/40 hover:text-gold-300 disabled:opacity-50"
        >
          <UploadCloud className="size-3.5" /> {value ? "Replace" : "Upload"}
        </button>
        <button
          type="button"
          onClick={() => setUrlMode((v) => !v)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-ink-600 px-3 text-xs text-stone hover:border-gold-500/40 hover:text-gold-300"
        >
          <Link2 className="size-3.5" /> URL
        </button>
        {value && (
          <button
            type="button"
            onClick={() => change(null)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-ink-600 px-3 text-xs text-stone hover:border-red-500/40 hover:text-red-300"
          >
            <Trash2 className="size-3.5" /> Remove
          </button>
        )}
      </div>

      {urlMode && (
        <input
          className={cn(inputClass, "h-9 text-xs")}
          placeholder="https://… or /demo/…"
          defaultValue={value ?? ""}
          onBlur={(e) => change(e.target.value.trim() || null)}
        />
      )}
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
