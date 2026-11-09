/**
 * Browser-side video shrink before upload (admin feed/product/testimonial
 * videos and customer review videos). Phone clips are often 25–40 MB of 1080p/4K
 * at 10+ Mbps; on the store they're watched on phones in a 9:16 card, so 720p at
 * ~1.8 Mbps looks the same and is ~5–10× smaller — faster to upload, to stream,
 * and lighter for the phone to decode.
 *
 * Uses WebCodecs (via mediabunny, loaded only when needed). If the browser
 * can't do it, or the result isn't smaller, the original file is used — an
 * upload never fails because of compression.
 */

/** Short side of the output (720 → 720×1280 for a vertical clip). */
const TARGET_SHORT_SIDE = 720;
const VIDEO_BITRATE = 1_800_000;
const AUDIO_BITRATE = 96_000;
/** Below this, don't bother (already small). */
const SKIP_UNDER_BYTES = 4 * 1024 * 1024;

export async function compressVideo(file: File, onProgress?: (pct: number) => void): Promise<File> {
  if (file.size < SKIP_UNDER_BYTES || typeof window === "undefined" || !("VideoEncoder" in window)) return file;
  try {
    const mb = await import("mediabunny");
    const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track) return file;
    const [w, h] = [await track.getDisplayWidth(), await track.getDisplayHeight()];
    const short = Math.min(w, h);
    const scale = short > TARGET_SHORT_SIDE ? TARGET_SHORT_SIDE / short : 1;
    // Even numbers: H.264 encoders reject odd sizes.
    const even = (n: number) => Math.max(2, Math.round((n * scale) / 2) * 2);

    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() });
    const conversion = await mb.Conversion.init({
      input,
      output,
      tracks: "primary",
      showWarnings: false,
      video: { width: even(w), height: even(h), fit: "contain", codec: "avc", bitrate: VIDEO_BITRATE, forceTranscode: true },
      audio: { codec: "aac", bitrate: AUDIO_BITRATE },
    });
    if (!conversion.isValid) return file;
    if (onProgress) conversion.onProgress = (p) => onProgress(Math.round(p * 100));
    await conversion.execute();

    const buf = output.target.buffer;
    if (!buf || buf.byteLength >= file.size * 0.9) return file;
    return new File([buf], file.name.replace(/\.\w+$/, "") + ".mp4", { type: "video/mp4" });
  } catch (e) {
    console.warn("[compressVideo] using the original file:", e);
    return file;
  }
}
