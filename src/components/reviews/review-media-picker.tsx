"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Film, ImagePlus, Loader2, Play, Video, X } from "lucide-react";
import { discardReviewUpload, getReviewUploadUrl } from "@/app/(store)/account/reviews/actions";
import type { ReviewMedia } from "@/lib/db/schema";
import { capturePoster, prepareImage, putWithProgress } from "@/lib/upload-client";
import { CUSTOMER_REVIEW_LIMITS } from "@/lib/validation/review";
import { cn } from "@/lib/utils";
import { SIGNED_OUT_ERROR, goToSignIn } from "@/lib/auth/signed-out";

const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const VIDEO_MAX_MB = 200;

async function uploadBlob(blob: Blob, onProgress: (pct: number) => void) {
  const res = await getReviewUploadUrl({ contentType: blob.type, size: blob.size });
  if (!res.ok) {
    if (res.error === SIGNED_OUT_ERROR) goToSignIn();
    throw new Error(res.error);
  }
  await putWithProgress(res.data.uploadUrl, blob, onProgress);
  return res.data.publicUrl;
}

async function uploadPhoto(file: File, onProgress: (pct: number) => void): Promise<ReviewMedia> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose a photo");
  return { type: "image", url: await uploadBlob(await prepareImage(file), onProgress), poster: null };
}

async function uploadVideo(file: File, onProgress: (pct: number) => void): Promise<ReviewMedia> {
  if (!VIDEO_TYPES.includes(file.type)) throw new Error("Please choose an MP4, MOV or WebM video");
  if (file.size > VIDEO_MAX_MB * 1024 * 1024) throw new Error(`The video can be at most ${VIDEO_MAX_MB} MB`);
  const posterBlob = await capturePoster(file);
  const url = await uploadBlob(file, onProgress);
  const poster = posterBlob ? await uploadBlob(posterBlob, () => {}).catch(() => null) : null;
  return { type: "video", url, poster };
}

type Pending = { id: string; kind: "image" | "video"; progress: number };

/** Up to 3 photos and 1 video for a customer review, uploaded straight to storage. */
export function ReviewMediaPicker({
  value,
  onChange,
  onUploadingChange,
}: {
  value: ReviewMedia[];
  onChange: (next: ReviewMedia[]) => void;
  /** True while any file is still uploading (the form waits for it). */
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Latest list for uploads that finish after a re-render (several at once).
  const latest = useRef(value);
  useLayoutEffect(() => {
    latest.current = value;
  }, [value]);
  const uploading = pending.length > 0;
  useEffect(() => onUploadingChange?.(uploading), [uploading, onUploadingChange]);
  // Uploaded on this visit: removing one deletes it from storage straight away.
  const uploadedHere = useRef(new Set<string>());

  const photos = value.filter((m) => m.type === "image").length + pending.filter((p) => p.kind === "image").length;
  const videos = value.filter((m) => m.type === "video").length + pending.filter((p) => p.kind === "video").length;
  const photoRoom = CUSTOMER_REVIEW_LIMITS.photos - photos;
  const videoRoom = CUSTOMER_REVIEW_LIMITS.videos - videos;

  async function add(files: File[], kind: "image" | "video") {
    setError(null);
    const room = kind === "image" ? photoRoom : videoRoom;
    const batch = files.slice(0, Math.max(0, room));
    if (files.length > batch.length) setError(kind === "image" ? `You can add up to ${CUSTOMER_REVIEW_LIMITS.photos} photos.` : "You can add one video.");
    const items = batch.map(() => ({ id: crypto.randomUUID(), kind, progress: 0 }));
    setPending((p) => [...p, ...items]);

    await Promise.all(
      batch.map(async (file, i) => {
        const progress = (pct: number) => setPending((p) => p.map((x) => (x.id === items[i].id ? { ...x, progress: pct } : x)));
        try {
          const media = kind === "image" ? await uploadPhoto(file, progress) : await uploadVideo(file, progress);
          uploadedHere.current.add(media.url);
          if (media.poster) uploadedHere.current.add(media.poster);
          onChange([...latest.current, media]);
          latest.current = [...latest.current, media];
        } catch (e) {
          setError(e instanceof Error && !e.message.includes("CORS") ? e.message : "Upload failed. Please check your connection and try again.");
        } finally {
          setPending((p) => p.filter((x) => x.id !== items[i].id));
        }
      }),
    );
  }

  function remove(item: ReviewMedia) {
    onChange(value.filter((m) => m !== item));
    for (const u of [item.url, item.poster]) {
      if (u && uploadedHere.current.delete(u)) void discardReviewUpload(u);
    }
  }

  return (
    <div>
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        data-testid="review-photos"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) void add(files, "image");
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept={VIDEO_TYPES.join(",")}
        hidden
        data-testid="review-video"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) void add(files, "video");
        }}
      />

      {(value.length > 0 || pending.length > 0) && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {value.map((m) => (
            <li key={m.url} className="relative size-20 overflow-hidden rounded-lg border border-ink-600 bg-ink-900">
              {m.type === "image" || m.poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.type === "image" ? m.url : m.poster!} alt="" className="size-full object-cover" />
              ) : (
                <Film className="m-auto mt-7 size-6 text-mute" strokeWidth={1.25} />
              )}
              {m.type === "video" && (
                <span className="absolute bottom-1 left-1 grid size-5 place-items-center rounded-full bg-black/70">
                  <Play className="size-2.5 fill-ivory text-ivory" />
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(m)}
                aria-label={m.type === "image" ? "Remove photo" : "Remove video"}
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/70 text-ivory hover:bg-red-500/80"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.id} className="grid size-20 place-items-center rounded-lg border border-dashed border-gold-500/40 bg-ink-900">
              <span className="flex flex-col items-center gap-1 text-[0.65rem] text-gold-300">
                <Loader2 className="size-4 animate-spin" />
                {p.progress}%
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2">
        <PickButton
          icon={ImagePlus}
          label="Add photos"
          note={`${Math.max(0, photoRoom)} of ${CUSTOMER_REVIEW_LIMITS.photos} left`}
          disabled={photoRoom <= 0}
          onClick={() => photoInput.current?.click()}
        />
        <PickButton
          icon={Video}
          label="Add a video"
          note={videoRoom > 0 ? `Up to ${VIDEO_MAX_MB} MB` : "Video added"}
          disabled={videoRoom <= 0}
          onClick={() => videoInput.current?.click()}
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function PickButton({
  icon: Icon,
  label,
  note,
  disabled,
  onClick,
}: {
  icon: typeof ImagePlus;
  label: string;
  note: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border border-dashed px-3 py-4 text-center transition-colors",
        disabled ? "border-ink-600 opacity-50" : "border-gold-500/40 bg-gold-500/5 hover:border-gold-400 hover:bg-gold-500/10",
      )}
    >
      <Icon className="size-5 text-gold-400" strokeWidth={1.4} />
      <span className="text-sm text-ivory">{label}</span>
      <span className="text-[0.7rem] text-mute">{note}</span>
    </button>
  );
}
