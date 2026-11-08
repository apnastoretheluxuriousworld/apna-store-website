import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { listCategoriesForAdmin } from "@/lib/data/categories";
import { HeroSlideForm } from "../hero-slide-form";

export const metadata: Metadata = { title: "Add banner" };

export default async function NewHeroSlidePage() {
  await requireAdminView();
  const categories = await listCategoriesForAdmin();
  return (
    <>
      <Link href="/admin/hero" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> Hero banners
      </Link>
      <PageHeader title="Add banner" />
      <HeroSlideForm categories={categories.map((c) => ({ name: c.name, slug: c.slug }))} />
    </>
  );
}
