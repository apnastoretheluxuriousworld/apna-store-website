"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Film, ImagePlus, Link2, Loader2, X } from "lucide-react";
import { discardUpload, getUploadUrl } from "@/app/admin/(panel)/upload-actions";
import { MediaLightbox, MediaThumb } from "@/components/reviews/media-viewer";
import type { ReviewMedia } from "@/lib/db/schema";
import { mediaTypeFromUrl } from "@/lib/validation/review";
import { capturePoster } from "@/lib/upload-client";
import { compressVideo } from "@/lib/compress-video";
import { putWithProgress, uploadImage, type UploadFolder } from "./image-upload";
import { inputClass } from "./form";
import { cn } from "@/lib/utils";

const IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/avif";
export const VIDEO_TYPES = "video/mp4,video/webm,video/quicktime";
export const VIDEO_MAX_MB = 200;

type Pending = { id: string; name: string; progress: number };

async function uploadBlob(blob: Blob, folder: UploadFolder, onProgress: (pct: number) => void) {
  const res = await getUploadUrl({ folder, contentType: blob.type, size: blob.size });
  if (!res.ok) throw new Error(res.error);
  await putWithProgress(res.data.uploadUrl, blob, onProgress);
  return res.data.publicUrl;
}

/** `posterAt`: seconds into the clip for the auto poster frame. */
export async function uploadVideo(
  file: File,
  folder: UploadFolder,
  onProgress: (pct: number) => void,
  posterAt?: number,
): Promise<ReviewMedia> {
  if (!VIDEO_TYPES.split(",").includes(file.type)) throw new Error("Use an MP4, WebM or MOV video");
  const posterBlob = await capturePoster(file, posterAt);
  // Shrink to 720p first (progress 0–40%), then upload (40–100%).
  const small = await compressVideo(file, (p) => onProgress(Math.round(p * 0.4)));
  if (small.size > VIDEO_MAX_MB * 1024 * 1024) throw new Error(`Videos can be at most ${VIDEO_MAX_MB} MB`);
  const url = await uploadBlob(small, folder, (p) => onProgress(40 + Math.round(p * 0.6)));
  const poster = posterBlob ? await uploadBlob(posterBlob, folder, () => {}).catch(() => null) : null;
  return { type: "video", url, poster };
}

/**
 * Photos + videos for a review. Images are resized to WebP in the browser;
 * videos go up as-is with an auto-captured poster frame. Controlled: `value`
 * is the ordered list.
 */
export function MediaUpload({
  value,
  onChange,
  folder = "reviews",
  max = 8,
  invalid,
}: {
  value: ReviewMedia[];
  onChange: (next: ReviewMedia[]) => void;
  folder?: UploadFolder;
  max?: number;
  invalid?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [urlMode, setUrlMode] = useState(false);
  const [urlText, setUrlText] = useState("");
  const [preview, setPreview] = useState<number | null>(null);
  const latest = useRef(value);
  latest.current = value;
  // Files uploaded during this visit: removing one before saving deletes it from the bucket.
  const uploadedHere = useRef(new Set<string>());

  const room = max - value.length - pending.length;

  async function addFiles(files: File[]) {
    setErrors([]);
    const batch = files.slice(0, Math.max(0, room));
    if (files.length > batch.length) setErrors([`At most ${max} photos/videos per review — ${files.length - batch.length} skipped.`]);
    const items = batch.map((f) => ({ id: crypto.randomUUID(), name: f.name, progress: 0 }));
    setPending((p) => [...p, ...items]);

    const results = await Promise.all(
      batch.map(async (file, i): Promise<ReviewMedia | null> => {
        const progress = (pct: number) => setPending((p) => p.map((x) => (x.id === items[i].id ? { ...x, progress: pct } : x)));
        try {
          if (file.type.startsWith("video/")) return await uploadVideo(file, folder, progress);
          return { type: "image", url: await uploadImage(file, folder, progress), poster: null };
        } catch (e) {
          setErrors((es) => [...es, `${file.name}: ${e instanceof Error ? e.message : "Upload failed"}`]);
          return null;
        } finally {
          setPending((p) => p.filter((x) => x.id !== items[i].id));
        }
      }),
    );
    const added = results.filter((m): m is ReviewMedia => !!m);
    for (const m of added) [m.url, m.poster].forEach((u) => u && uploadedHere.current.add(u));
    if (added.length) onChange([...latest.current, ...added]);
  }

  function remove(item: ReviewMedia) {
    onChange(value.filter((m) => m.url !== item.url));
    for (const u of [item.url, item.poster]) if (u && uploadedHere.current.delete(u)) void discardUpload(u);
  }

  function move(i: number, step: number) {
    const j = i + step;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function addUrl() {
    const url = urlText.trim();
    if (!url) return;
    if (!(url.startsWith("/") || url.startsWith("https://"))) return setErrors(["URL must start with https:// or /"]);
    if (value.some((m) => m.url === url)) return setErrors(["Already added"]);
    if (room <= 0) return setErrors([`At most ${max} photos/videos per review`]);
    onChange([...value, { type: mediaTypeFromUrl(url), url, poster: null }]);
    setUrlText("");
    setErrors([]);
  }

  return (
    <div className="space-y-3">
      <ul
        className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
          if (files.length) addFiles(files);
        }}
      >
        {value.map((m, i) => (
          <li key={m.url} className="group relative aspect-square overflow-hidden rounded-lg border border-ink-600">
            <button type="button" onClick={() => setPreview(i)} aria-label={`Preview ${m.type} ${i + 1}`} className="absolute inset-0">
              <MediaThumb item={m} sizes="160px" className="size-full" />
            </button>
            <button
              type="button"
              onClick={() => remove(m)}
              aria-label={`Remove ${m.type} ${i + 1}`}
              className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-ink-950/85 text-stone hover:text-red-300"
            >
              <X className="size-3.5" />
            </button>
            {value.length > 1 && (
              <span className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${m.type} ${i + 1} earlier`}
                  className="grid size-6 place-items-center rounded-full bg-ink-950/85 text-stone hover:text-gold-300 disabled:invisible"
                >
                  <ArrowLeft className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === value.length - 1}
                  aria-label={`Move ${m.type} ${i + 1} later`}
                  className="grid size-6 place-items-center rounded-full bg-ink-950/85 text-stone hover:text-gold-300 disabled:invisible"
                >
                  <ArrowRight className="size-3" />
                </button>
              </span>
            )}
          </li>
        ))}
        {pending.map((p) => (
          <li key={p.id} className="grid aspect-square place-items-center rounded-lg border border-ink-600 bg-ink-900">
            <div className="flex flex-col items-center gap-1.5 text-[0.65rem] text-gold-300">
              <Loader2 className="size-4 animate-spin" />
              {p.progress}%
            </div>
          </li>
        ))}
        {room > 0 && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className={cn(
                "flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-mute transition-colors hover:border-gold-500/60 hover:text-gold-300",
                invalid ? "border-red-500/60" : "border-gold-500/30",
              )}
            >
              <span className="flex gap-1">
                <ImagePlus className="size-5" strokeWidth={1.25} />
                <Film className="size-5" strokeWidth={1.25} />
              </span>
              <span className="px-2 text-center text-[0.65rem]">Photos or videos</span>
            </button>
          </li>
        )}
      </ul>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-mute">
        <span>
          {value.length} / {max} · photos are resized automatically · videos up to {VIDEO_MAX_MB} MB (MP4, WebM, MOV)
        </span>
        <button type="button" onClick={() => setUrlMode((v) => !v)} className="inline-flex items-center gap-1.5 text-stone hover:text-gold-300">
          <Link2 className="size-3.5" /> Add by URL
        </button>
      </div>

      {urlMode && (
        <div className="flex gap-2">
          <input
            className={cn(inputClass, "h-9 text-xs")}
            placeholder="https://…/photo.webp or …/clip.mp4"
            aria-label="Photo or video URL"
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
          />
          <button type="button" onClick={addUrl} className="h-9 shrink-0 rounded-lg border border-ink-600 px-3 text-xs text-stone hover:border-gold-500/40 hover:text-gold-300">
            Add
          </button>
        </div>
      )}

      {errors.map((e) => (
        <p key={e} className="text-xs text-red-400" role="alert">
          {e}
        </p>
      ))}

      <input
        ref={input}
        type="file"
        multiple
        accept={`${IMAGE_TYPES},${VIDEO_TYPES}`}
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) addFiles(files);
          e.target.value = "";
        }}
      />

      {preview !== null && <MediaLightbox media={value} start={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
