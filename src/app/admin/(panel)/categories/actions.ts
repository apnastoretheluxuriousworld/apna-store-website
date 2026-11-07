"use server";

import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema as s } from "@/lib/db";
import { CATEGORIES_TAG } from "@/lib/data/categories";
import { categoryInputSchema } from "@/lib/validation/category";
import { deleteUnreferencedUploads } from "@/lib/storage/cleanup";
import { pgCode, zodFieldErrors, type ActionResult } from "@/lib/actions";

/** Refresh the storefront's cached categories and the admin's client cache. */
function categoriesChanged() {
  updateTag(CATEGORIES_TAG);
  revalidatePath("/admin", "layout");
}

/** Create or update a category together with its field definitions. */
export async function saveCategory(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  }
  const { id, fields, ...data } = parsed.data;
  const d = db();

  const [clash] = await d
    .select({ id: s.categories.id })
    .from(s.categories)
    .where(id ? and(eq(s.categories.slug, data.slug), ne(s.categories.id, id)) : eq(s.categories.slug, data.slug));
  if (clash) {
    return { ok: false, error: "That URL slug is already used.", fieldErrors: { slug: "Already used by another category" } };
  }

  // Remember the current cover so a replaced/removed one can be deleted from storage after saving.
  const [before] = id
    ? await d.select({ imageUrl: s.categories.imageUrl }).from(s.categories).where(eq(s.categories.id, id))
    : [];

  try {
    const categoryId = await d.transaction(async (tx) => {
      // An id we don't know yet = create with it (idempotent retries from the admin outbox).
      const updated = id
        ? await tx
            .update(s.categories)
            .set({ ...data, description: data.description || null })
            .where(eq(s.categories.id, id))
            .returning({ id: s.categories.id })
        : [];
      let catId: string;
      if (updated.length) catId = updated[0].id;
      else {
        const [{ max }] = await tx
          .select({ max: sql<number>`coalesce(max(${s.categories.sortOrder}), -1)::int` })
          .from(s.categories);
        const [created] = await tx
          .insert(s.categories)
          .values({ ...data, ...(id && { id }), description: data.description || null, sortOrder: max + 1 })
          .returning({ id: s.categories.id });
        catId = created.id;
      }

      // Sync fields: delete removed → update kept (key is immutable) → insert new.
      const existing = await tx
        .select({ id: s.categoryFields.id })
        .from(s.categoryFields)
        .where(eq(s.categoryFields.categoryId, catId));
      const existingIds = new Set(existing.map((f) => f.id));
      const keptIds = fields.map((f) => f.id).filter((x): x is string => !!x && existingIds.has(x));

      await tx
        .delete(s.categoryFields)
        .where(
          keptIds.length
            ? and(eq(s.categoryFields.categoryId, catId), notInArray(s.categoryFields.id, keptIds))
            : eq(s.categoryFields.categoryId, catId),
        );

      for (const [i, f] of fields.entries()) {
        const values = {
          label: f.label,
          type: f.type,
          options: f.type === "select" ? f.options : [],
          unit: f.type === "text" || f.type === "number" ? f.unit || null : null,
          required: f.required,
          filterable: f.filterable,
          sortOrder: i,
        };
        if (f.id && existingIds.has(f.id)) {
          await tx
            .update(s.categoryFields)
            .set(values)
            .where(and(eq(s.categoryFields.id, f.id), eq(s.categoryFields.categoryId, catId)));
        } else {
          await tx.insert(s.categoryFields).values({ ...values, categoryId: catId, key: f.key });
        }
      }
      return catId;
    });

    if (before?.imageUrl && before.imageUrl !== (data.imageUrl || null)) {
      await deleteUnreferencedUploads([before.imageUrl]);
    }
    categoriesChanged();
    return { ok: true, data: { id: categoryId } };
  } catch (e) {
    if (pgCode(e) === "23505") return { ok: false, error: "A field key or slug is already in use." };
    console.error("[saveCategory]", e);
    return { ok: false, error: "Couldn't save the category. Please try again." };
  }
}

const idSchema = z.uuid();

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Invalid category." };

  const d = db();
  const [{ n }] = await d
    .select({ n: sql<number>`count(*)::int` })
    .from(s.products)
    .where(eq(s.products.categoryId, id));
  if (n > 0) {
    return { ok: false, error: `This category has ${n} product${n === 1 ? "" : "s"}. Move or delete them first.` };
  }
  let imageUrl: string | null = null;
  try {
    const [deleted] = await d
      .delete(s.categories)
      .where(eq(s.categories.id, id))
      .returning({ imageUrl: s.categories.imageUrl });
    imageUrl = deleted?.imageUrl ?? null;
  } catch (e) {
    if (pgCode(e) === "23503") return { ok: false, error: "This category still has products." };
    throw e;
  }
  await deleteUnreferencedUploads([imageUrl]);
  categoriesChanged();
  return { ok: true };
}

export async function reorderCategories(ids: string[]): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.array(z.uuid()).max(200).safeParse(ids);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) {
    return { ok: false, error: "Invalid order." };
  }
  const d = db();
  await d.transaction(async (tx) => {
    for (const [i, id] of parsed.data.entries()) {
      await tx.update(s.categories).set({ sortOrder: i }).where(eq(s.categories.id, id));
    }
  });
  categoriesChanged();
  return { ok: true };
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success || typeof isActive !== "boolean") return { ok: false, error: "Invalid request." };
  await db().update(s.categories).set({ isActive }).where(inArray(s.categories.id, [id]));
  categoriesChanged();
  return { ok: true };
}
