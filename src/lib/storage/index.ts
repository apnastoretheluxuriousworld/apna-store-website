import "server-only";
import type { S3Client } from "@aws-sdk/client-s3";
import { storageEnv } from "@/lib/env";
import * as core from "./core";

export { UploadRejected, uploadFolders, uploadKinds, type BucketUsage, type UploadFolder } from "./core";

function config(): core.StorageConfig {
  const e = storageEnv();
  return {
    endpoint: e.S3_ENDPOINT,
    region: e.S3_REGION,
    accessKeyId: e.S3_ACCESS_KEY_ID,
    secretAccessKey: e.S3_SECRET_ACCESS_KEY,
    bucket: e.S3_BUCKET,
    publicUrl: e.S3_PUBLIC_URL,
  };
}

const globalForS3 = globalThis as unknown as { __apnaS3?: S3Client };
const client = () => (globalForS3.__apnaS3 ??= core.createS3(config()));

export const storage = {
  /** Presigned direct-upload URL (admin-only callers — wired up in F3/F4). */
  createUploadUrl: (input: { folder: core.UploadFolder; contentType: string; size: number }) =>
    core.createUploadUrl(client(), config(), input),
  publicUrl: (key: string) => core.publicUrlFor(config(), key),
  delete: (key: string) => core.deleteObject(client(), config(), key),
  ping: () => core.pingBucket(client(), config()),
  /** Total size of everything in the bucket — slow on big buckets; use getStorageUsage() (cached). */
  usage: () => core.bucketUsage(client(), config()),
};

/** Object key for a URL inside our bucket, or null (external URL, demo path, or storage not set up). */
export function keyFromUrl(url: string): string | null {
  let base: string;
  try {
    base = config().publicUrl + "/";
  } catch {
    return null;
  }
  if (!url.startsWith(base)) return null;
  const key = url.slice(base.length);
  return /^[a-z]+\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.[a-z0-9]+$/.test(key) ? key : null;
}

/** Best-effort delete of uploaded files that are no longer referenced. Never throws. */
export async function deleteUploads(urls: string[]) {
  const keys = [...new Set(urls.map(keyFromUrl).filter((k): k is string => !!k))];
  await Promise.all(
    keys.map((k) =>
      storage.delete(k).catch((e) => console.warn("[storage] delete failed", k, e instanceof Error ? e.message : e)),
    ),
  );
  return keys.length;
}
