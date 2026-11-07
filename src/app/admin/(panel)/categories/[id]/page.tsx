import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { getCategoryWithFields } from "@/lib/data/categories";
import { CategoryForm } from "../category-form";

export const metadata: Metadata = { title: "Edit category" };

export default async function EditCategoryPage({ params }: PageProps<"/admin/categories/[id]">) {
  await requireAdminView();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const data = await getCategoryWithFields(id);
  if (!data) notFound();
  const { category: c, fields, productCount } = data;

  return (
    <>
      <Link href="/admin/categories" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> Categories
      </Link>
      <PageHeader
        title={c.name}
        description={`${fields.length} fields · ${productCount} products`}
        actions={
          <Link
            href={`/shop/${c.slug}`}
            target="_blank"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-ink-600 px-4 text-xs text-stone hover:border-gold-500/40 hover:text-gold-300"
          >
            View in store <ExternalLink className="size-3.5" />
          </Link>
        }
      />
      <CategoryForm
        productCount={productCount}
        initial={{
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description ?? "",
          imageUrl: c.imageUrl ?? "",
          isActive: c.isActive,
          fields: fields.map((f) => ({
            id: f.id,
            label: f.label,
            key: f.key,
            type: f.type,
            optionsText: f.options.join(", "),
            unit: f.unit ?? "",
            required: f.required,
            filterable: f.filterable,
          })),
        }}
      />
    </>
  );
}
