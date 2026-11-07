/**
 * npm run test:db — applies every migration in ./drizzle to a throwaway
 * in-memory Postgres (PGlite), runs the seed twice and checks the results.
 * Needs no credentials; run it after any schema change.
 */
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import * as s from "../src/lib/db/schema";
import { seed, seedCategories, seedHomepageSections, seedSettings } from "../src/lib/db/seed";

const pg = new PGlite();
const db = drizzle(pg, { schema: s, casing: "snake_case" });
const step = (m: string) => console.log(`  ✓ ${m}`);

console.log("\nDatabase test (in-memory Postgres)");

await migrate(db, { migrationsFolder: "./drizzle" });
const tables = await pg.query<{ n: number }>(
  `select count(*)::int as n from information_schema.tables where table_schema = 'public'`,
);
assert.equal(tables.rows[0].n, 20);
step("migrations apply cleanly — 20 tables");

const noRls = await pg.query<{ relname: string }>(
  `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
);
assert.deepEqual(noRls.rows, [], `tables without RLS: ${noRls.rows.map((r) => r.relname).join(", ")}`);
step("row-level security enabled on every table");

const first = await seed(db);
const expectedFields = seedCategories.reduce((n, c) => n + c.fields.length, 0);
assert.deepEqual(first, {
  categories: seedCategories.length,
  fields: expectedFields,
  sections: seedHomepageSections.length,
  settings: Object.keys(seedSettings).length,
});
step(`seed inserts ${first.categories} categories, ${first.fields} fields, ${first.sections} sections, ${first.settings} settings`);

// Simulate an admin edit, then re-seed: nothing duplicated, edit preserved.
await db.update(s.categories).set({ name: "Luxury Watches" }).where(eq(s.categories.slug, "watches"));
const second = await seed(db);
assert.deepEqual(second, { categories: 0, fields: 0, sections: 0, settings: 0 });
const [watches] = await db.select().from(s.categories).where(eq(s.categories.slug, "watches"));
assert.equal(watches.name, "Luxury Watches");
step("re-seed is idempotent and keeps admin edits");

// Category fields come back in order with typed options.
const fields = await db
  .select()
  .from(s.categoryFields)
  .where(eq(s.categoryFields.categoryId, watches.id))
  .orderBy(s.categoryFields.sortOrder);
assert.equal(fields[0].key, "brand");
assert.ok(fields.find((f) => f.key === "movement")?.options.includes("Automatic"));
step("category fields stored with types and options");

// A product with category attributes + product-only custom attributes.
const [p] = await db
  .insert(s.products)
  .values({
    categoryId: watches.id,
    name: "Aurum Chronograph",
    slug: "aurum-chronograph",
    price: 48500,
    stock: 3,
    attributes: { brand: "Demo", movement: "Automatic", case_size: 42 },
    customAttributes: [{ name: "Box & papers", value: "Included" }],
  })
  .returning();
assert.equal(p.status, "draft");
assert.equal(p.attributes.case_size, 42);
assert.equal(p.customAttributes[0].name, "Box & papers");
step("products store category + custom attributes as JSON");

// Constraints guard bad data.
await assert.rejects(
  db.insert(s.products).values({ categoryId: watches.id, name: "x", slug: "x", price: -1 }),
);
await assert.rejects(db.delete(s.categories).where(eq(s.categories.id, watches.id)));
step("constraints: negative price rejected, category with products can't be deleted");

// Settings round-trip
const [cod] = await db.select().from(s.settings).where(eq(s.settings.key, "cod_min_order"));
assert.equal(cod.value, 500);
const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.homepageSections);
assert.equal(n, 5);
step("settings + homepage sections seeded (COD min ₹500)");

await pg.close();
console.log("\nAll database tests passed ✓\n");
