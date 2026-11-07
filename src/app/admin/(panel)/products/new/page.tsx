import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { requireAdminView } from "@/lib/auth/session";
import { listCategoriesWithFields } from "@/lib/data/products";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage({ searchParams }: PageProps<"/admin/products/new">) {
  await requireAdminView();
  const { category } = await searchParams;
  const categories = await listCategoriesWithFields();
  const pre = typeof category === "string" && z.uuid().safeParse(category).success ? category : undefined;

  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> Products
      </Link>
      <ProductForm categories={categories} defaultCategoryId={categories.some((c) => c.id === pre) ? pre : undefined} />
    </>
  );
}
