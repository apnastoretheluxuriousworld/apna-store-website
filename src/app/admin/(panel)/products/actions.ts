"use server";

import { and, eq, like, notInArray, or, sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema as s } from "@/lib/db";
import { PRODUCTS_TAG } from "@/lib/data/products";
import { deleteUnreferencedUploads } from "@/lib/storage/cleanup";
import { normalizeAttributes, productInputSchema, totalStock } from "@/lib/validation/product";
import { slugify } from "@/lib/validation/category";
import { VIDEO_URL_PG_REGEX } from "@/lib/media";
import { pgCode, zodFieldErrors, type ActionResult } from "@/lib/actions";

type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

/** Refresh the storefront's cached products and the admin's client cache. */
function productsChanged() {
  updateTag(PRODUCTS_TAG);
  revalidatePath("/admin", "layout");
}

/** Delete files from the bucket that nothing references any more (other products, orders, homepage…). */
const cleanupImages = (urls: string[]) => deleteUnreferencedUploads(urls);

/**
 * URL slug from the name: "aurum-chronograph", then "-2", "-3"… if taken.
 * Set once on create and never changed, so product links stay valid after a rename.
 */
async function uniqueSlug(tx: Tx, name: string) {
  const base = slugify(name, 70) || "product";
  const rows = await tx
    .select({ slug: s.products.slug })
    .from(s.products)
    .where(or(eq(s.products.slug, base), like(s.products.slug, `${base}-%`)));
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

async function nextFeaturedOrder(tx: Tx) {
  const [{ max }] = await tx
    .select({ max: sql<number>`coalesce(max(${s.products.featuredOrder}), -1)::int` })
    .from(s.products)
    .where(eq(s.products.isFeatured, true));
  return max + 1;
}

/**
 * Create or update a product with its images, variants and attributes.
 * Idempotent for the admin outbox: an id the database doesn't know yet means
 * "create with this id", so retrying a save that already went through updates it.
 */
export async function saveProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, images, variants, attributes: rawAttributes, slug: _ignored, ...data } = parsed.data;
  const d = db();

  const fields = await d
    .select()
    .from(s.categoryFields)
    .where(eq(s.categoryFields.categoryId, data.categoryId));
  const [category] = await d.select({ id: s.categories.id }).from(s.categories).where(eq(s.categories.id, data.categoryId));
  if (!category) return { ok: false, error: "That category no longer exists.", fieldErrors: { categoryId: "Choose a category" } };

  const { values: attributes, errors: attrErrors } = normalizeAttributes(fields, rawAttributes);
  if (Object.keys(attrErrors).length) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: Object.fromEntries(Object.entries(attrErrors).map(([k, m]) => [`attributes.${k}`, m])),
    };
  }

  const row = {
    ...data,
    description: data.description || null,
    sku: data.sku || null,
    stock: totalStock(data.stock, variants),
    attributes,
  };

  let removedImages: string[] = [];
  try {
    const productId = await d.transaction(async (tx) => {
      const [before] = id
        ? await tx.select({ isFeatured: s.products.isFeatured }).from(s.products).where(eq(s.products.id, id)).for("update")
        : [];
      let pid: string;
      if (before && id) {
        pid = id;
        const featuredOrder = row.isFeatured && !before.isFeatured ? await nextFeaturedOrder(tx) : undefined;
        await tx
          .update(s.products)
          .set({ ...row, ...(featuredOrder !== undefined && { featuredOrder }) })
          .where(eq(s.products.id, pid));
      } else {
        const featuredOrder = row.isFeatured ? await nextFeaturedOrder(tx) : 0;
        const slug = await uniqueSlug(tx, data.name);
        const [created] = await tx
          .insert(s.products)
          .values({ ...row, ...(id && { id }), slug, featuredOrder })
          .returning({ id: s.products.id });
        pid = created.id;
      }

      // Images: replace the ordered list (nothing else references image rows).
      const oldImages = await tx
        .select({ url: s.productImages.url })
        .from(s.productImages)
        .where(eq(s.productImages.productId, pid));
      const keep = new Set(images.map((i) => i.url));
      removedImages = oldImages.map((i) => i.url).filter((u) => !keep.has(u));
      await tx.delete(s.productImages).where(eq(s.productImages.productId, pid));
      if (images.length) {
        await tx.insert(s.productImages).values(
          images.map((img, i) => ({ productId: pid!, url: img.url, alt: img.alt || null, sortOrder: i })),
        );
      }

      // Variants: sync by id — order items reference variant ids, so keep them stable.
      const existing = await tx
        .select({ id: s.productVariants.id })
        .from(s.productVariants)
        .where(eq(s.productVariants.productId, pid));
      const existingIds = new Set(existing.map((v) => v.id));
      const keptIds = variants.map((v) => v.id).filter((x): x is string => !!x && existingIds.has(x));
      await tx
        .delete(s.productVariants)
        .where(
          keptIds.length
            ? and(eq(s.productVariants.productId, pid), notInArray(s.productVariants.id, keptIds))
            : eq(s.productVariants.productId, pid),
        );
      for (const [i, v] of variants.entries()) {
        const values = { label: v.label, sku: v.sku || null, priceOverride: v.priceOverride, stock: v.stock, sortOrder: i };
        if (v.id && existingIds.has(v.id)) {
          await tx
            .update(s.productVariants)
            .set(values)
            .where(and(eq(s.productVariants.id, v.id), eq(s.productVariants.productId, pid)));
        } else {
          await tx.insert(s.productVariants).values({ ...values, productId: pid });
        }
      }
      return pid;
    });

    await cleanupImages(removedImages);
    productsChanged();
    return { ok: true, data: { id: productId } };
  } catch (e) {
    if (pgCode(e) === "23505") return { ok: false, error: "Another product was just saved with this name. Please try again." };
    if (pgCode(e) === "23503") return { ok: false, error: "That category no longer exists." };
    console.error("[saveProduct]", e);
    return { ok: false, error: "Couldn't save the product. Please try again." };
  }
}

const idSchema = z.uuid();

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid product." };
  const d = db();
  const images = await d
    .select({ url: s.productImages.url })
    .from(s.productImages)
    .where(eq(s.productImages.productId, id));
  // Order items keep their own snapshot (name, price, image) and are set to null.
  await d.delete(s.products).where(eq(s.products.id, id));
  await cleanupImages(images.map((i) => i.url));
  productsChanged();
  return { ok: true };
}

export async function setProductStatus(id: string, status: "draft" | "active"): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success || !["draft", "active"].includes(status)) return { ok: false, error: "Invalid request." };
  const d = db();
  if (status === "active") {
    const [{ n }] = await d
      .select({ n: sql<number>`count(*)::int` })
      .from(s.productImages)
      .where(and(eq(s.productImages.productId, id), sql`${s.productImages.url} !~* ${VIDEO_URL_PG_REGEX}`));
    if (n === 0) return { ok: false, error: "Add at least one photo before going live." };
  }
  await d.update(s.products).set({ status }).where(eq(s.products.id, id));
  productsChanged();
  return { ok: true };
}

export async function setProductFeatured(id: string, isFeatured: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success || typeof isFeatured !== "boolean") return { ok: false, error: "Invalid request." };
  await db().transaction(async (tx) => {
    const featuredOrder = isFeatured ? await nextFeaturedOrder(tx) : 0;
    await tx.update(s.products).set({ isFeatured, featuredOrder }).where(eq(s.products.id, id));
  });
  productsChanged();
  return { ok: true };
}
