import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { requireAdminView } from "@/lib/auth/session";
import { getHomeCollectionIdsForAdmin, listCategoriesForAdmin } from "@/lib/data/categories";
import { CategoryList } from "./category-list";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireAdminView();
  const [rows, homeIds] = await Promise.all([listCategoriesForAdmin(), getHomeCollectionIdsForAdmin()]);

  return (
    <>
      <PageHeader
        title="Categories"
        actions={
          <ButtonLink href="/admin/categories/new" size="md">
            <Plus className="size-4" /> New category
          </ButtonLink>
        }
      />
      <CategoryList initial={rows} homeIds={homeIds} />
    </>
  );
}
