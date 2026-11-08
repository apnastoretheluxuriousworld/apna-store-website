import type { Metadata } from "next";
import { FabLink, PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { listHeroForAdmin } from "@/lib/data/hero";
import { HeroSlideList } from "./hero-slide-list";

export const metadata: Metadata = { title: "Hero banners" };

export default async function HeroPage() {
  await requireAdminView();
  const rows = await listHeroForAdmin();

  return (
    <>
      <PageHeader title="Hero banners" />
      <HeroSlideList initial={rows} />
      <FabLink href="/admin/hero/new" label="Add banner" />
    </>
  );
}
