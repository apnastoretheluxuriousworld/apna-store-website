/**
 * Category validation — shared by the admin form (client) and the Server
 * Actions (server), so both enforce exactly the same rules.
 */
import { z } from "zod";

export const FIELD_TYPES = ["text", "number", "select", "boolean"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  select: "Dropdown",
  boolean: "Yes / No",
};

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** "Case Size (mm)" → "case_size_mm" */
export function keyify(input: string) {
  const k = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return /^[a-z]/.test(k) ? k : k ? `f_${k}`.slice(0, 40) : "";
}

const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || v.startsWith("/") || /^https:\/\//.test(v), "Must be an https:// URL")
  .transform((v) => (v === "" ? null : v));

const fieldBase = {
  id: z.uuid().optional(),
  label: z.string().trim().min(1, "Label is required").max(40),
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{0,39}$/, "Lowercase letters, numbers and _ only"),
  type: z.enum(FIELD_TYPES),
  unit: z.string().trim().max(10).optional().default(""),
  required: z.boolean().default(false),
  filterable: z.boolean().default(false),
};

const optionsArray = z.array(z.string().trim().min(1).max(40)).max(40);

function checkFields<T extends { key: string; type: FieldType; options: string[] }>(
  fields: T[],
  ctx: z.RefinementCtx,
  optionsPath: "options" | "optionsText" = "options",
) {
  const seen = new Map<string, number>();
  fields.forEach((f, i) => {
    if (seen.has(f.key)) {
      ctx.addIssue({ code: "custom", path: ["fields", i, "key"], message: `Duplicate key "${f.key}"` });
    }
    seen.set(f.key, i);
    if (f.type === "select" && f.options.length < 2) {
      ctx.addIssue({ code: "custom", path: ["fields", i, optionsPath], message: "Add at least 2 options" });
    }
  });
}

const categoryBase = {
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "At least 2 characters").max(40),
  slug: z
    .string()
    .trim()
    .min(2, "At least 2 characters")
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only"),
  description: z.string().trim().max(160).optional().default(""),
  imageUrl,
  isActive: z.boolean(),
};

/** What the Server Action accepts. */
export const categoryInputSchema = z
  .object({
    ...categoryBase,
    fields: z.array(z.object({ ...fieldBase, options: optionsArray })).max(30, "Up to 30 fields"),
  })
  .superRefine((v, ctx) => checkFields(v.fields, ctx));

export type CategoryInput = z.input<typeof categoryInputSchema>;

/** Form shape: dropdown options are typed as one comma-separated string. */
export const categoryFormSchema = z
  .object({
    ...categoryBase,
    fields: z
      .array(
        z.object({
          ...fieldBase,
          optionsText: z.string().max(1000).default(""),
        }),
      )
      .max(30, "Up to 30 fields"),
  })
  .superRefine((v, ctx) =>
    checkFields(
      v.fields.map((f) => ({ ...f, options: splitOptions(f.optionsText) })),
      ctx,
      "optionsText", // the form's input is optionsText, so errors must point there
    ),
  );

export type CategoryFormValues = z.input<typeof categoryFormSchema>;

export function splitOptions(text: string) {
  return [...new Set(text.split(",").map((o) => o.trim()).filter(Boolean))];
}
