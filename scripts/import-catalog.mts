/**
 * npm run db:import-catalog — one-off move of the starter catalog into the real
 * stack: uploads the photos in public/demo to the bucket (R2), creates the
 * products in the database (Live, with images), and points category covers at
 * their uploaded copies.
 *
 * Idempotent: products whose slug already exists are skipped, and a category
 * cover is only replaced while it still points at a local /demo/ file.
 * The photos are stand-ins until the client's own arrive (some show
 * third-party brands) — replace them before launch.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import { need } from "./_env.mts";
import { pgSslFromEnv } from "../src/lib/db/ssl";
import * as schema from "../src/lib/db/schema";
import * as st from "../src/lib/storage/core";

type Item = { name: string; description: string; price: number; file: string; attributes?: Record<string, string | number | boolean> };

const catalog: Record<string, Item[]> = {
  watches: [
    { name: "Aurum Chronograph", description: "18K gold tone · 42mm", price: 48500, file: "aurum-chronograph", attributes: { case_size: 42, case_material: "Gold", strap: "Metal Bracelet" } },
    { name: "Glacier Moonphase", description: "Ceramic · Blue baguette bezel", price: 86000, file: "glacier-moonphase", attributes: { case_material: "Ceramic" } },
    { name: "Rosé Pavé Chronograph", description: "Rose gold · Diamond set", price: 124000, file: "rose-pave-chronograph", attributes: { case_material: "Rose Gold" } },
    { name: "Emerald Racer", description: "Yellow gold · Green dial", price: 98000, file: "emerald-racer", attributes: { case_material: "Gold", dial_color: "Green" } },
    { name: "Noir Chronograph", description: "Two-tone steel · 41mm", price: 32500, file: "noir-chronograph", attributes: { case_size: 41, case_material: "Stainless Steel" } },
  ],
  handbags: [
    { name: "Bordeaux Flap Bag", description: "Leather & suede · Gold hardware", price: 42000, file: "bordeaux-flap-bag" },
    { name: "Gilded Croc Tote", description: "Croc-embossed · Gold piping", price: 39500, file: "gilded-croc-tote", attributes: { style: "Tote" } },
    { name: "Aurelia Top Handle", description: "Croc-embossed · Sculpted handle", price: 34000, file: "aurelia-top-handle", attributes: { style: "Top Handle" } },
    { name: "Noir Chain Shoulder Bag", description: "Quilted leather · Chain strap", price: 46500, file: "noir-chain-shoulder-bag", attributes: { style: "Shoulder Bag" } },
  ],
  shoes: [
    { name: "Patent Oxford", description: "Patent leather · Lace-up", price: 16500, file: "patent-oxford", attributes: { style: "Oxford" } },
    { name: "Midnight Glitter Oxford", description: "Patent & glitter · Gold welt", price: 19800, file: "midnight-glitter-oxford", attributes: { style: "Oxford" } },
    { name: "Monk Strap Patent", description: "Double monk · Perforated", price: 21500, file: "monk-strap-patent", attributes: { style: "Monk Strap" } },
  ],
  sunglasses: [
    { name: "Aviator Noir", description: "Gold frame · Dark lens", price: 14500, file: "aviator-noir", attributes: { frame_shape: "Aviator" } },
    { name: "Regal Shield", description: "Gold & black · Shield lens", price: 18900, file: "regal-shield", attributes: { frame_shape: "Shield" } },
    { name: "Silver Square Aviator", description: "Silver frame · Polarised", price: 12900, file: "silver-square-aviator", attributes: { frame_shape: "Aviator", lens: "Polarised" } },
  ],
  wallets: [
    { name: "Motorsport Card Wallet", description: "Leather · Crest emblem", price: 6900, file: "motorsport-card-wallet", attributes: { style: "Card Holder" } },
    { name: "Embossed Card Holder", description: "Black leather · Slim", price: 4900, file: "embossed-card-holder", attributes: { style: "Card Holder" } },
    { name: "Heritage Bifold Tan", description: "Saffiano leather · Tan", price: 7900, file: "heritage-bifold-tan", attributes: { style: "Bifold" } },
    { name: "Espresso Bifold Gift Set", description: "Full-grain leather · Gift box", price: 8500, file: "espresso-bifold-gift-set", attributes: { style: "Bifold" } },
  ],
  belts: [
    { name: "Onyx Auto-Lock Belt", description: "Leather · Ratchet buckle", price: 5900, file: "onyx-auto-lock-belt", attributes: { buckle: "Auto-lock" } },
    { name: "Stallion Buckle Belt", description: "Leather · Gold stallion buckle", price: 7400, file: "stallion-buckle-belt" },
    { name: "Signature Pebble Belt", description: "Pebbled leather · Signature buckle", price: 11500, file: "signature-pebble-belt" },
  ],
  caps: [
    { name: "Monogram Suede Cap", description: "Suede · Embossed monogram", price: 6500, file: "monogram-suede-cap", attributes: { style: "Baseball" } },
    { name: "Monogram Bucket Hat", description: "Jacquard · Reversible", price: 7200, file: "monogram-bucket-hat", attributes: { style: "Bucket" } },
    { name: "Crystal Crest Cap", description: "Crystal embellished · Gold crest", price: 9800, file: "crystal-crest-cap", attributes: { style: "Baseball" } },
  ],
  perfumes: [
    { name: "Velora", description: "Eau de Parfum · 100ml", price: 12900, file: "velora-eau-de-parfum", attributes: { concentration: "Eau de Parfum", volume: 100 } },
    { name: "Oud Santal", description: "Eau de Parfum · 100ml", price: 15400, file: "oud-santal", attributes: { concentration: "Eau de Parfum", volume: 100, family: "Oud" } },
    { name: "Crown Amber", description: "Extrait · 100ml", price: 18500, file: "crown-amber", attributes: { concentration: "Extrait de Parfum", volume: 100 } },
    { name: "Azure Royale Attar", description: "Concentrated attar · 12ml", price: 6900, file: "azure-royale-attar", attributes: { concentration: "Attar", volume: 12 } },
  ],
};

/** Shown on the homepage "Best Sellers" strip, in this order. */
const featured = [
  "aurum-chronograph", "noir-chain-shoulder-bag", "velora-eau-de-parfum", "aviator-noir",
  "rose-pave-chronograph", "bordeaux-flap-bag", "azure-royale-attar", "monk-strap-patent",
];

const slugOf = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

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
const s = schema;

async function upload(folder: st.UploadFolder, localPath: string) {
  const body = await readFile(path.join("public", localPath));
  const key = st.buildKey(folder, "image/webp");
  return { key, url: await st.putObject(s3, cfg, key, new Uint8Array(body), "image/webp") };
}

const report = { productsCreated: 0, productsSkipped: 0, imagesUploaded: 0, coversMoved: 0 };

try {
  const cats = await db.select().from(s.categories);
  const bySlug = new Map(cats.map((c) => [c.slug, c]));

  // 1. Category covers → bucket
  for (const c of cats) {
    if (!c.imageUrl?.startsWith("/demo/")) continue;
    const { url } = await upload("categories", c.imageUrl);
    await db.update(s.categories).set({ imageUrl: url }).where(eq(s.categories.id, c.id));
    report.coversMoved++;
    console.log(`  ✓ cover  ${c.slug}`);
  }

  // 2. Products (+ image) → bucket + database
  const allSlugs = Object.values(catalog).flatMap((items) => items.map((i) => slugOf(i.name)));
  const existing = new Set(
    (await db.select({ slug: s.products.slug }).from(s.products).where(inArray(s.products.slug, allSlugs))).map((r) => r.slug),
  );

  for (const [catSlug, items] of Object.entries(catalog)) {
    const cat = bySlug.get(catSlug);
    if (!cat) {
      console.warn(`  ! category "${catSlug}" not found — run npm run db:seed first; skipping its products`);
      continue;
    }
    for (const item of items) {
      const slug = slugOf(item.name);
      if (existing.has(slug)) {
        report.productsSkipped++;
        continue;
      }
      const img = await upload("products", `/demo/${catSlug}/${item.file}.webp`);
      report.imagesUploaded++;
      const fi = featured.indexOf(item.file);
      await db.transaction(async (tx) => {
        const [p] = await tx
          .insert(s.products)
          .values({
            categoryId: cat.id,
            name: item.name,
            slug,
            description: item.description,
            price: item.price,
            stock: 1,
            status: "active",
            isFeatured: fi >= 0,
            featuredOrder: fi >= 0 ? fi : 0,
            attributes: item.attributes ?? {},
          })
          .returning({ id: s.products.id });
        await tx.insert(s.productImages).values({ productId: p.id, url: img.url, storageKey: img.key, alt: item.name, sortOrder: 0 });
      });
      report.productsCreated++;
      console.log(`  ✓ product ${catSlug}/${slug}`);
    }
  }

  console.log("\nImport complete:");
  console.table(report);
  console.log("Open any admin page action (or restart the dev server) so the storefront cache refreshes.\n");
} catch (e) {
  console.error("\n✗ Import failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
