import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { listCategoriesForAdmin } from "@/lib/data/categories";
import { CategoryList } from "./category-list";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireAdmin();
  const rows = await listCategoriesForAdmin();

  return (
    <>
      <PageHeader
        title="Categories"
        description="Drag to set the order shown in the store menu. Tap a category to edit its product fields."
        actions={
          <ButtonLink href="/admin/categories/new" size="md">
            <Plus className="size-4" /> New category
          </ButtonLink>
        }
      />
      <CategoryList initial={rows} />
    </>
  );
}
