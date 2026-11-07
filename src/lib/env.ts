import "server-only";
import { z } from "zod";

/**
 * Server environment, validated lazily on first use so `next build` works
 * without secrets. Database and storage are validated separately so a missing
 * storage key never takes the database (and admin login) down with it.
 */

const dbSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  DB_POOL_MAX: z.coerce.number().int().positive().default(5),
  // TLS to the database (see lib/db/ssl.ts): "require" for Supabase,
  // "disable" for a Postgres on the same machine (VPS / docker).
  DB_SSL: z.enum(["require", "disable"]).default("require"),
});

// Reject the placeholder values shipped in .env.example.
const real = (v: string) => !/YOUR_|XXXXXXXX/.test(v);
const notPlaceholder = "still has the placeholder value from .env.example";

const storageSchema = z.object({
  S3_ENDPOINT: z.url().refine(real, notPlaceholder),
  S3_REGION: z.string().default("auto"),
  S3_ACCESS_KEY_ID: z.string().min(1).refine(real, notPlaceholder),
  S3_SECRET_ACCESS_KEY: z.string().min(1).refine(real, notPlaceholder),
  S3_BUCKET: z.string().min(1),
  S3_PUBLIC_URL: z
    .url()
    .refine(real, notPlaceholder)
    .transform((u) => u.replace(/\/+$/, "")),
});

function loader<T extends z.ZodType>(schema: T, area: string) {
  let cached: z.infer<T> | undefined;
  return (): z.infer<T> => {
    if (cached) return cached;
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`);
      throw new Error(`Invalid ${area} environment variables:\n${issues.join("\n")}\nSee .env.example`);
    }
    return (cached = parsed.data);
  };
}

export const dbEnv = loader(dbSchema, "database");
export const storageEnv = loader(storageSchema, "storage");
