import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { getProductForEdit, listCategoriesWithFields } from "@/lib/data/products";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  await requireAdminView();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [data, categories] = await Promise.all([getProductForEdit(id), listCategoriesWithFields()]);
  if (!data) notFound();
  const { product: p, images, variants } = data;

  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> Products
      </Link>
      <PageHeader
        title={p.name}
        description={`${p.status === "active" ? "Live" : "Draft"} · last saved ${p.updatedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}`}
      />
      <ProductForm
        categories={categories}
        initial={{
          id: p.id,
          categoryId: p.categoryId,
          name: p.name,
          slug: p.slug,
          description: p.description ?? "",
          price: p.price,
          compareAtPrice: p.compareAtPrice,
          sku: p.sku ?? "",
          stock: p.stock,
          trackStock: p.trackStock,
          status: p.status,
          isFeatured: p.isFeatured,
          // The form edits strings; numbers go back through normalizeAttributes on save.
          attributes: Object.fromEntries(
            Object.entries(p.attributes).map(([k, v]) => [k, typeof v === "boolean" ? v : String(v)]),
          ),
          customAttributes: p.customAttributes,
          images: images.map((i) => ({ url: i.url, alt: i.alt ?? "" })),
          variants: variants.map((v) => ({
            id: v.id,
            label: v.label,
            sku: v.sku ?? "",
            priceOverride: v.priceOverride,
            stock: v.stock,
          })),
        }}
      />
    </>
  );
}
