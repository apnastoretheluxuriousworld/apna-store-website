/**
 * npm run feed:import -- <folder> — bulk-add videos to "Our Feed" (Admin → Feed).
 *
 * For each video in the folder (natural name order: reel1, reel2, … reel10):
 *  1. converts it for the web: H.264 MP4, 1080×1920, 30 fps, ≤5 Mbps, faststart. Anything that
 *     isn't 9:16 is centre-cropped. Files that are already like that are uploaded as-is.
 *  2. takes the first frame as the thumbnail (WebP)
 *  3. uploads both to the bucket's reels/ folder
 *  4. adds them to the FRONT of the feed in that order, shown, without captions
 *     (add captions or change thumbnails in the admin).
 * Needs ffmpeg/ffprobe on PATH.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Pool } from "pg";
import sharp from "sharp";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { fail, need, ok } from "./_env.mts";
import { pgSslFromEnv } from "../src/lib/db/ssl";
import * as schema from "../src/lib/db/schema";
import * as st from "../src/lib/storage/core";

const dir = process.argv[2];
if (!dir) fail("Usage: npm run feed:import -- <folder with videos>");
const files = readdirSync(dir)
  .filter((f) => /\.(mp4|mov|m4v|webm)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
if (!files.length) fail(`No videos in ${dir}`);

const cfg: st.StorageConfig = {
  endpoint: need("S3_ENDPOINT"),
  region: process.env.S3_REGION || "auto",
  accessKeyId: need("S3_ACCESS_KEY_ID"),
  secretAccessKey: need("S3_SECRET_ACCESS_KEY"),
  bucket: need("S3_BUCKET"),
  publicUrl: need("S3_PUBLIC_URL").replace(/\/+$/, ""),
};
const s3 = st.createS3(cfg);
const pool = new Pool({ connectionString: need("DATABASE_URL_DIRECT"), ssl: pgSslFromEnv(), max: 1 });
const db = drizzle(pool, { schema, casing: "snake_case" });
const work = mkdtempSync(path.join(tmpdir(), "feed-import-"));
const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();

function probe(file: string) {
  const [codec, w, h] = run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height", "-of", "csv=p=0", file]).split(",");
  return { codec, width: Number(w), height: Number(h) };
}

/** A web-ready 9:16 MP4: the file itself if it already is one, else a converted copy. */
function webVideo(file: string, name: string) {
  const p = probe(file);
  if (/\.mp4$/i.test(file) && p.codec === "h264" && p.width === 1080 && p.height === 1920) return file;
  const out = path.join(work, `${name}.mp4`);
  const crop = "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)'"; // centre-crop to 9:16 (no-op when already 9:16)
  run("ffmpeg", [
    "-y", "-loglevel", "error", "-i", file,
    "-vf", `${crop},scale=1080:1920:flags=lanczos,fps=30`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-maxrate", "5M", "-bufsize", "10M", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out,
  ]);
  return out;
}

async function upload(file: string, contentType: string) {
  const key = st.buildKey("reels", contentType);
  return st.putObject(s3, cfg, key, new Uint8Array(readFileSync(file)), contentType);
}

console.log(`\nImporting ${files.length} video(s) from ${dir}`);
const rows: { videoUrl: string; posterUrl: string }[] = [];
const uploaded: string[] = [];
try {
  for (const f of files) {
    const name = path.parse(f).name;
    const video = webVideo(path.join(dir, f), name);
    // First frame as PNG (every ffmpeg build has it), then WebP via sharp.
    const frame = path.join(work, `${name}.png`);
    run("ffmpeg", ["-y", "-loglevel", "error", "-i", video, "-frames:v", "1", frame]);
    const poster = path.join(work, `${name}.webp`);
    await sharp(frame).webp({ quality: 82 }).toFile(poster);
    const videoUrl = await upload(video, "video/mp4");
    uploaded.push(videoUrl);
    const posterUrl = await upload(poster, "image/webp");
    uploaded.push(posterUrl);
    rows.push({ videoUrl, posterUrl });
    ok(`${f} → ${(readFileSync(video).length / 1024 / 1024).toFixed(1)} MB  ${videoUrl}`);
  }

  // New videos go first, in file order; existing ones move down.
  await db.transaction(async (tx) => {
    await tx.update(schema.reels).set({ sortOrder: sql`${schema.reels.sortOrder} + ${rows.length}` });
    await tx.insert(schema.reels).values(rows.map((r, i) => ({ ...r, title: "", isActive: true, sortOrder: i })));
  });
  ok(`${rows.length} video(s) added to the front of the feed`);
  console.log("\nThe homepage refreshes within the hour, or right away after any save in Admin → Feed.\n");
} catch (e) {
  // Don't leave orphaned files in the bucket.
  await Promise.all(uploaded.map((u) => st.deleteObject(s3, cfg, u.slice(cfg.publicUrl.length + 1)).catch(() => {})));
  fail(e instanceof Error ? e.message : String(e));
} finally {
  rmSync(work, { recursive: true, force: true });
  await pool.end();
}
