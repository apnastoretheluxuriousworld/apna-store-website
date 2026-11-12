"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import Image from "next/image";
import { ImagePlus, Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/admin/ui";
import { ConfirmDialog, Field, FormActions, Switch, inputClass } from "@/components/admin/form";
import { enqueue, pendingSave } from "@/components/admin/outbox";
import { discardUpload } from "@/app/admin/(panel)/upload-actions";
import { uploadImage } from "@/components/admin/image-upload";
import { FEED_LIMITS, feedVideoInputSchema } from "@/lib/validation/feed";
import { FEED_ACCEPT, VIDEO_MAX_MB, uploadFeedVideo } from "./upload";
import { cn } from "@/lib/utils";

export type FeedVideoFormValues = {
  id: string;
  caption: string;
  videoUrl: string;
  posterUrl: string | null;
  isActive: boolean;
};

const resolver = zodResolver(feedVideoInputSchema) as unknown as Resolver<FeedVideoFormValues>;

export function FeedVideoForm({ initial }: { initial: FeedVideoFormValues }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const thumbInput = useRef<HTMLInputElement>(null);
  const [thumbProgress, setThumbProgress] = useState<number | null>(null);
  // Videos uploaded during this visit: replacing one again before saving deletes it from the bucket.
  const uploadedHere = useRef(new Set<string>());

  const form = useForm<FeedVideoFormValues>({ resolver, defaultValues: initial });
  const { register, control, handleSubmit, setValue, formState } = form;
  const errors = formState.errors;
  const [videoUrl, posterUrl] = useWatch({ control, name: ["videoUrl", "posterUrl"] });

  // Fresh server data (or a still-queued save, which is newer) — never over unsaved edits.
  useEffect(() => {
    if (form.formState.isDirty) return;
    const queued = pendingSave(initial.id)?.formValues as FeedVideoFormValues | undefined;
    form.reset(queued ?? initial);
  }, [initial, form]);
  const busy = progress !== null || thumbProgress !== null;
  const showActions = formState.isDirty || busy;

  /** Drop a file uploaded during this visit that's no longer used (saved files are cleaned up by the server). */
  function forget(url: string | null) {
    if (url && uploadedHere.current.delete(url)) void discardUpload(url);
  }

  async function replaceThumb(file: File) {
    setThumbProgress(0);
    try {
      const url = await uploadImage(file, "reels", setThumbProgress);
      forget(form.getValues("posterUrl"));
      uploadedHere.current.add(url);
      setValue("posterUrl", url, { shouldDirty: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setThumbProgress(null);
    }
  }

  async function replace(file: File) {
    setProgress(0);
    try {
      const up = await uploadFeedVideo(file, setProgress);
      forget(form.getValues("videoUrl"));
      forget(form.getValues("posterUrl"));
      [up.videoUrl, up.posterUrl].forEach((u) => u && uploadedHere.current.add(u));
      setValue("videoUrl", up.videoUrl, { shouldDirty: true });
      setValue("posterUrl", up.posterUrl, { shouldDirty: true });
      if (up.warning) toast.warning(`This video ${up.warning}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  }

  function save(values: FeedVideoFormValues) {
    const payload = { ...values, id: initial.id };
    enqueue({
      kind: "feed.save",
      entityId: initial.id,
      label: values.caption || "Feed video",
      payload,
      formValues: payload,
      editHref: `/admin/feed/${initial.id}`,
      preview: payload,
    });
    uploadedHere.current.clear(); // now owned by the saved row (the server cleans up replaced files)
    toast.success("Video saved");
    form.reset(payload);
  }
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => void handleSubmit(save)(e);

  function onDelete() {
    enqueue({ kind: "feed.delete", entityId: initial.id, label: initial.caption || "Feed video", payload: initial.id });
    toast.success("Video deleted");
    router.push("/admin/feed");
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cn("space-y-3 lg:space-y-5 lg:pb-0", showActions && "pb-20")}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-5">
        <Card className="space-y-3">
          <div className="relative mx-auto aspect-9/16 w-full max-w-72 overflow-hidden rounded-lg bg-ink-950 lg:max-w-none">
            <video
              key={videoUrl}
              src={videoUrl}
              poster={posterUrl ?? undefined}
              controls
              playsInline
              preload="metadata"
              className="absolute inset-0 size-full object-cover"
            />
            {progress !== null && (
              <div className="absolute inset-0 grid place-items-center bg-ink-950/80">
                <span className="flex flex-col items-center gap-2 text-xs text-gold-300">
                  <Loader2 className="size-5 animate-spin" />
                  Uploading {progress}%
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-ink-600 text-sm text-stone hover:border-gold-500/40 hover:text-gold-300 disabled:opacity-50"
          >
            <RefreshCw className="size-3.5" /> Replace video
          </button>
          <div className="flex items-center gap-3">
            <span className="relative aspect-9/16 w-12 shrink-0 overflow-hidden rounded-md border border-ink-600 bg-ink-900">
              {posterUrl && <Image src={posterUrl} alt="" fill sizes="48px" unoptimized className="object-cover" />}
              {thumbProgress !== null && (
                <span className="absolute inset-0 grid place-items-center bg-ink-950/80">
                  <Loader2 className="size-3.5 animate-spin text-gold-300" />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ivory">Thumbnail</span>
              <span className="block text-xs text-mute">First frame by default</span>
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => thumbInput.current?.click()}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-ink-600 px-3 text-xs text-stone hover:border-gold-500/40 hover:text-gold-300 disabled:opacity-50"
            >
              <ImagePlus className="size-3.5" /> Change
            </button>
          </div>
          <input
            ref={thumbInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void replaceThumb(f);
              e.target.value = "";
            }}
          />
          <p className="text-center text-[0.65rem] text-mute">9:16 · up to {VIDEO_MAX_MB} MB</p>
          <input
            ref={fileInput}
            type="file"
            accept={FEED_ACCEPT}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void replace(f);
              e.target.value = "";
            }}
          />
        </Card>

        <div className="space-y-3 lg:space-y-5">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ivory">Show in feed</p>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Show in feed" />}
              />
            </div>
          </Card>
          <Card>
            <Field
              label="Caption"
              error={errors.caption?.message}
              hint="Optional"
              htmlFor="caption"
            >
              <textarea
                id="caption"
                rows={3}
                maxLength={FEED_LIMITS.caption}
                className={cn(inputClass, "h-auto py-3 leading-relaxed")}
                placeholder="Caption"
                aria-invalid={!!errors.caption}
                {...register("caption")}
              />
            </Field>
          </Card>
          <Card className="flex flex-wrap items-center justify-between gap-3 border-red-500/20">
            <p className="text-sm text-ivory">Delete video</p>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="h-10 rounded-lg border border-red-500/40 px-4 text-sm text-red-300 hover:bg-red-500/10"
            >
              Delete
            </button>
          </Card>
        </div>
      </div>

      {showActions && <FormActions cancelHref="/admin/feed" saving={busy} label="Save changes" />}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this video?"
        body="This can't be undone."
        pending={false}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </form>
  );
}
