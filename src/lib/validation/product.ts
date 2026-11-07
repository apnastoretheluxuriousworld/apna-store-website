/**
 * Product validation — shared by the admin form (client) and the Server
 * Actions (server). Category-specific values (`attributes`) are checked by
 * `normalizeAttributes` against that category's field definitions.
 */
import { z } from "zod";
import type { AttributeValue } from "@/lib/db/schema";
import { imageUrl, type FieldType } from "./category";
import { isVideoUrl } from "@/lib/media";

export const PRODUCT_STATUSES = ["draft", "active"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const LIMITS = { images: 12, variants: 50, customAttributes: 20 } as const;

/** Empty inputs and NaN (from `valueAsNumber` on an empty box) become null. */
const emptyToNull = (v: unknown) =>
  v === "" || v === undefined || v === null || (typeof v === "number" && Number.isNaN(v)) ? null : v;

const rupees = z
  .number({ error: "Enter an amount in rupees" })
  .int("Whole rupees only")
  .min(0, "Can't be negative")
  .max(10_000_000, "Too large");

const optionalRupees = z.preprocess(emptyToNull, rupees.nullable());

const stockCount = z.preprocess(
  (v) => emptyToNull(v) ?? 0,
  z.number({ error: "Enter a number" }).int("Whole numbers only").min(0, "Can't be negative").max(100_000),
);

const imageSchema = z.object({
  url: imageUrl.pipe(z.string({ error: "Image URL is required" })),
  alt: z.string().trim().max(120).optional().default(""),
});

const variantSchema = z.object({
  id: z.uuid().optional(),
  label: z.string().trim().min(1, "Label is required").max(40),
  sku: z.string().trim().max(40).optional().default(""),
  priceOverride: optionalRupees,
  stock: stockCount,
});

const customAttributeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  value: z.string().trim().min(1, "Value is required").max(200),
});

export const productInputSchema = z
  .object({
    id: z.uuid().optional(),
    categoryId: z.uuid({ error: "Choose a category" }),
    name: z.string().trim().min(2, "At least 2 characters").max(120),
    /** Ignored: the server makes the slug from the name on create and never changes it. */
    slug: z.string().optional(),
    description: z.string().trim().max(5000).optional().default(""),
    price: rupees,
    compareAtPrice: optionalRupees,
    sku: z.string().trim().max(40).optional().default(""),
    stock: stockCount,
    /** false = always available (made to order, digital…): stock isn't counted. */
    trackStock: z.boolean().default(true),
    status: z.enum(PRODUCT_STATUSES),
    isFeatured: z.boolean(),
    /** Raw values keyed by field key; checked by normalizeAttributes. */
    attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
    customAttributes: z.array(customAttributeSchema).max(LIMITS.customAttributes, `Up to ${LIMITS.customAttributes}`),
    images: z.array(imageSchema).max(LIMITS.images, `Up to ${LIMITS.images} photos and videos`),
    variants: z.array(variantSchema).max(LIMITS.variants, `Up to ${LIMITS.variants} variants`),
  })
  .superRefine((v, ctx) => {
    if (v.compareAtPrice !== null && v.compareAtPrice <= v.price) {
      ctx.addIssue({ code: "custom", path: ["compareAtPrice"], message: "Must be higher than the price" });
    }
    if (v.status === "active" && !v.images.some((i) => !isVideoUrl(i.url))) {
      ctx.addIssue({ code: "custom", path: ["images"], message: "Add at least one photo before going live" });
    }
    const labels = new Set<string>();
    v.variants.forEach((variant, i) => {
      const k = variant.label.toLowerCase();
      if (labels.has(k)) ctx.addIssue({ code: "custom", path: ["variants", i, "label"], message: "Duplicate label" });
      labels.add(k);
    });
    const names = new Set<string>();
    v.customAttributes.forEach((a, i) => {
      const k = a.name.toLowerCase();
      if (names.has(k)) ctx.addIssue({ code: "custom", path: ["customAttributes", i, "name"], message: "Duplicate name" });
      names.add(k);
    });
  });

export type ProductInput = z.input<typeof productInputSchema>;
export type ProductOutput = z.output<typeof productInputSchema>;

/* ───────────── Category fields → attribute values ───────────── */

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options: string[];
  unit: string | null;
  required: boolean;
};

/**
 * Validates and converts raw form values against the category's fields.
 * Keys that aren't fields of this category are dropped (e.g. left over after
 * switching category). Empty optional values are omitted; Yes/No is always stored.
 */
export function normalizeAttributes(
  fields: FieldDef[],
  raw: Record<string, AttributeValue | null | undefined>,
): { values: Record<string, AttributeValue>; errors: Record<string, string> } {
  const values: Record<string, AttributeValue> = {};
  const errors: Record<string, string> = {};

  for (const f of fields) {
    const v = raw[f.key];
    if (f.type === "boolean") {
      values[f.key] = v === true || v === "true";
      continue;
    }
    const text = v === null || v === undefined || typeof v === "boolean" ? "" : String(v).trim();
    if (text === "") {
      if (f.required) errors[f.key] = `${f.label} is required`;
      continue;
    }
    if (f.type === "number") {
      const n = Number(text);
      if (!Number.isFinite(n)) errors[f.key] = "Enter a number";
      else if (Math.abs(n) > 1e9) errors[f.key] = "Too large";
      else values[f.key] = n;
    } else if (f.type === "select") {
      if (!f.options.includes(text)) errors[f.key] = "Choose one of the options";
      else values[f.key] = text;
    } else {
      if (text.length > 120) errors[f.key] = "Up to 120 characters";
      else values[f.key] = text;
    }
  }
  return { values, errors };
}

/** Stock is per variant when variants exist; the product's total is their sum. */
export function totalStock(stock: number, variants: { stock: number }[]) {
  return variants.length ? variants.reduce((n, v) => n + v.stock, 0) : stock;
}
