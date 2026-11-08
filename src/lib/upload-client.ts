/**
 * Browser-side upload helpers, shared by the admin and the storefront
 * (payment screenshots, customer reviews). Client-only: uses canvas and XMLHttpRequest.
 */

/**
 * Downscale + convert to WebP in the browser before upload: a 6 MB phone
 * photo becomes ~200 KB, so uploads are fast and storage stays small.
 */
export async function prepareImage(file: File, maxSide = 1600): Promise<Blob> {
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

/** Grab a still frame (~0.5 s in) as a WebP poster. Null if the browser can't decode the video. */
export async function capturePoster(file: File, at = 0.5): Promise<Blob | null> {
  const src = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;
  const wait = (event: "loadeddata" | "seeked") =>
    new Promise<void>((resolve, reject) => {
      video.addEventListener(event, () => resolve(), { once: true });
      video.addEventListener("error", () => reject(new Error("decode")), { once: true });
    });
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000));
  try {
    await Promise.race([wait("loadeddata"), timeout]);
    video.currentTime = Math.min(at, (video.duration || 1) / 2);
    await Promise.race([wait("seeked"), timeout]);
    const scale = Math.min(1, 1080 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    if (!canvas.width || !canvas.height) return null;
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.82));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(src);
  }
}
