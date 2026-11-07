import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't load .env itself.
try {
  process.loadEnvFile(".env");
} catch {
  /* no .env — rely on the real environment (CI / server) */
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: {
    // Migrations need a session-level connection (not the transaction pooler).
    url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
