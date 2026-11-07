/**
 * npm run infra:check — verifies the credentials in .env end to end:
 *   Database: connect, migrations applied, seed present
 *   Storage:  bucket reachable, upload, public URL serves it, delete
 */
import { fail, need, ok } from "./_env.mts";
import pg from "pg";
import { pgSslFromEnv } from "../src/lib/db/ssl";
import * as storage from "../src/lib/storage/core";

console.log("\nDatabase");
const sql = new pg.Client({ connectionString: need("DATABASE_URL"), ssl: pgSslFromEnv(), connectionTimeoutMillis: 10_000 });
const one = async (q: string) => (await sql.query(q)).rows[0];
try {
  await sql.connect();
  const { version } = await one("select version()");
  ok(`connected — ${String(version).split(",")[0]}`);
  const { exists } = await one("select to_regclass('public.categories') is not null as exists");
  if (!exists) fail("tables missing — run `npm run db:migrate`");
  ok("schema migrated");
  const { count } = await one("select count(*)::int as count from categories");
  if (count === 0) console.log("  ! no categories yet — run `npm run db:seed`");
  else ok(`${count} categories`);
} catch (e) {
  fail(`database: ${e instanceof Error ? e.message : e}`);
} finally {
  await sql.end();
}

console.log("\nStorage");
const cfg: storage.StorageConfig = {
  endpoint: need("S3_ENDPOINT"),
  region: process.env.S3_REGION || "auto",
  accessKeyId: need("S3_ACCESS_KEY_ID"),
  secretAccessKey: need("S3_SECRET_ACCESS_KEY"),
  bucket: need("S3_BUCKET"),
  publicUrl: need("S3_PUBLIC_URL").replace(/\/+$/, ""),
};
const s3 = storage.createS3(cfg);
const key = `healthcheck/${Date.now()}.txt`;
try {
  await storage.pingBucket(s3, cfg);
  ok(`bucket "${cfg.bucket}" reachable`);
  const url = await storage.putObject(s3, cfg, key, "apna-store ok", "text/plain");
  ok("upload works");
  const res = await fetch(url);
  if (res.ok && (await res.text()) === "apna-store ok") ok(`public URL serves files — ${cfg.publicUrl}`);
  else console.log(`  ! public URL returned ${res.status} — enable public access on the bucket (SETUP.md §2)`);
  const presigned = await storage.createUploadUrl(s3, cfg, { folder: "products", contentType: "image/webp", size: 1024 });
  ok(`presigned upload URL generated (${presigned.key})`);
} catch (e) {
  fail(`storage: ${e instanceof Error ? e.message : e}`);
} finally {
  await storage.deleteObject(s3, cfg, key).catch(() => {});
}

console.log("\nAll good ✓\n");
