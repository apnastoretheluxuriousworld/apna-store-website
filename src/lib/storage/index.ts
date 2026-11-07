import "server-only";
import type { S3Client } from "@aws-sdk/client-s3";
import { storageEnv } from "@/lib/env";
import * as core from "./core";

export { UploadRejected, uploadFolders, uploadKinds, type UploadFolder } from "./core";

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
};
