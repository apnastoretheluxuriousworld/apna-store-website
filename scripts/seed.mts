/** npm run db:seed — idempotent; safe to re-run. */
import { need } from "./_env.mts";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgSslFromEnv } from "../src/lib/db/ssl";
import * as schema from "../src/lib/db/schema";
import { seed } from "../src/lib/db/seed";

const client = new Pool({ connectionString: need("DATABASE_URL_DIRECT"), ssl: pgSslFromEnv(), max: 1 });
const db = drizzle(client, { schema, casing: "snake_case" });

try {
  const r = await seed(db);
  console.log("\nSeed complete (new rows):");
  console.table(r);
} catch (e) {
  console.error("\n✗ Seed failed:", e instanceof Error ? e.message : e);
  console.error("  Did you run `npm run db:migrate` first?\n");
  process.exitCode = 1;
} finally {
  await client.end();
}
