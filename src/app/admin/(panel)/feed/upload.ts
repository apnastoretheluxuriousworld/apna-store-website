/**
 * Browser-side upload for feed videos: checks the clip is vertical, then sends
 * it (plus an auto-captured poster frame) straight to the bucket.
 */
import { uploadVideo, VIDEO_MAX_MB, VIDEO_TYPES } from "@/components/admin/media-upload";

export const FEED_ACCEPT = VIDEO_TYPES;
export { VIDEO_MAX_MB };

/** Width/height of a local video file, or null if the browser can't read it (e.g. some MOV codecs). */
function videoSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const src = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const done = (r: { width: number; height: number } | null) => {
      clearTimeout(timer);
      URL.revokeObjectURL(src);
      resolve(r);
    };
    const timer = setTimeout(() => done(null), 8000);
    v.onloadedmetadata = () => done(v.videoWidth && v.videoHeight ? { width: v.videoWidth, height: v.videoHeight } : null);
    v.onerror = () => done(null);
    v.src = src;
  });
}

export type FeedUpload = { videoUrl: string; posterUrl: string | null; warning?: string };

/**
 * Throws with a readable message for wrong type/size or a landscape/square clip.
 * A vertical clip that isn't exactly 9:16 is accepted with a warning (edges get cropped).
 */
export async function uploadFeedVideo(file: File, onProgress: (pct: number) => void): Promise<FeedUpload> {
  if (!VIDEO_TYPES.split(",").includes(file.type)) throw new Error("Use an MP4, WebM or MOV video");
  const size = await videoSize(file);
  let warning: string | undefined;
  if (size) {
    if (size.width >= size.height) throw new Error("This video isn't vertical. Feed videos must be 9:16 (portrait).");
    const ratio = size.width / size.height;
    if (Math.abs(ratio - 9 / 16) > 0.03) warning = "isn't exactly 9:16, so its edges will be cropped slightly";
  }
  // Thumbnail defaults to the first frame (0.05 s: seeking to exactly 0 may not fire "seeked").
  const m = await uploadVideo(file, "reels", onProgress, 0.05);
  return { videoUrl: m.url, posterUrl: m.poster ?? null, warning };
}
