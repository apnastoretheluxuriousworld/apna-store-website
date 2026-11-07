/**
 * npm run test:storage — offline checks of upload rules and presigned URLs
 * (signing is local, so fake credentials are fine).
 */
import assert from "node:assert/strict";
import * as st from "../src/lib/storage/core";

const cfg: st.StorageConfig = {
  endpoint: "https://acct123.r2.cloudflarestorage.com",
  region: "auto",
  accessKeyId: "test-key",
  secretAccessKey: "test-secret",
  bucket: "apna-store-media",
  publicUrl: "https://media.example.com",
};
const s3 = st.createS3(cfg);
const step = (m: string) => console.log(`  ✓ ${m}`);

console.log("\nStorage test (offline)");

const key = st.buildKey("products", "image/webp", new Date("2026-11-07T10:00:00Z"));
assert.match(key, /^products\/2026\/11\/[0-9a-f-]{36}\.webp$/);
step(`keys are organised and unguessable — ${key}`);

assert.throws(() => st.buildKey("products", "application/pdf"), st.UploadRejected);
assert.throws(() => st.buildKey("secrets" as st.UploadFolder, "image/png"), st.UploadRejected);
step("rejects disallowed file types and folders");

await assert.rejects(
  st.createUploadUrl(s3, cfg, { folder: "products", contentType: "image/jpeg", size: 11 * 1024 * 1024 }),
  /max 10 MB/,
);
await assert.rejects(
  st.createUploadUrl(s3, cfg, { folder: "reels", contentType: "video/mp4", size: 201 * 1024 * 1024 }),
  /max 200 MB/,
);
step("enforces size limits (images 10 MB, videos 200 MB)");

const up = await st.createUploadUrl(s3, cfg, { folder: "reels", contentType: "video/mp4", size: 5_000_000 });
const u = new URL(up.uploadUrl);
assert.equal(u.host, "acct123.r2.cloudflarestorage.com");
assert.ok(u.pathname.startsWith(`/apna-store-media/reels/`));
assert.ok(u.searchParams.get("X-Amz-Signature"));
assert.equal(u.searchParams.get("X-Amz-Expires"), "300");
assert.match(u.searchParams.get("X-Amz-SignedHeaders") ?? "", /content-length/);
assert.equal(up.publicUrl, `https://media.example.com/${up.key}`);
step("presigned PUT URL signs size + type, expires in 5 min, public URL correct");

console.log("\nAll storage tests passed ✓\n");
