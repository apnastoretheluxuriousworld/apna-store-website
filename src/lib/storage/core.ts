/**
 * S3-compatible object storage (Cloudflare R2 today; MinIO / AWS S3 later —
 * only env values change). No Next.js imports, so CLI scripts can use it too.
 */
import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StorageConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string; // no trailing slash
};

export function createS3(cfg: StorageConfig) {
  return new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    forcePathStyle: true, // works on R2, MinIO and S3
  });
}

/* ───────────── Upload rules ───────────── */

const MB = 1024 * 1024;

export const uploadKinds = {
  image: {
    types: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" },
    maxBytes: 10 * MB,
  },
  video: {
    types: { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" },
    maxBytes: 200 * MB,
  },
} as const;

export const uploadFolders = ["products", "categories", "hero", "reels", "testimonials", "reviews"] as const;
export type UploadFolder = (typeof uploadFolders)[number];

export class UploadRejected extends Error {}

function extensionFor(contentType: string): { ext: string; maxBytes: number } {
  for (const kind of Object.values(uploadKinds)) {
    const ext = (kind.types as Record<string, string>)[contentType];
    if (ext) return { ext, maxBytes: kind.maxBytes };
  }
  throw new UploadRejected(`File type not allowed: ${contentType}`);
}

/** e.g. products/2026/11/3f2a…c1.webp */
export function buildKey(folder: UploadFolder, contentType: string, now = new Date()) {
  if (!uploadFolders.includes(folder)) throw new UploadRejected(`Unknown folder: ${folder}`);
  const { ext } = extensionFor(contentType);
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${folder}/${yyyy}/${mm}/${crypto.randomUUID()}.${ext}`;
}

export function publicUrlFor(cfg: StorageConfig, key: string) {
  return `${cfg.publicUrl}/${key}`;
}

/* ───────────── Operations ───────────── */

/**
 * Presigned PUT URL for a direct browser → bucket upload (files never pass
 * through our server). Content type and exact size are signed, so the
 * client can't swap in a different or larger file.
 */
export async function createUploadUrl(
  client: S3Client,
  cfg: StorageConfig,
  input: { folder: UploadFolder; contentType: string; size: number },
) {
  const { maxBytes } = extensionFor(input.contentType);
  if (!Number.isInteger(input.size) || input.size <= 0) throw new UploadRejected("Invalid file size");
  if (input.size > maxBytes) {
    throw new UploadRejected(`File too large: max ${Math.round(maxBytes / MB)} MB`);
  }
  const key = buildKey(input.folder, input.contentType);
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.size,
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { expiresIn: 300 },
  );
  return { key, uploadUrl, publicUrl: publicUrlFor(cfg, key) };
}

export async function putObject(
  client: S3Client,
  cfg: StorageConfig,
  key: string,
  body: Uint8Array | string,
  contentType: string,
) {
  await client.send(
    new PutObjectCommand({ Bucket: cfg.bucket, Key: key, Body: body, ContentType: contentType }),
  );
  return publicUrlFor(cfg, key);
}

export async function deleteObject(client: S3Client, cfg: StorageConfig, key: string) {
  await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
}

export async function pingBucket(client: S3Client, cfg: StorageConfig) {
  await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
}
