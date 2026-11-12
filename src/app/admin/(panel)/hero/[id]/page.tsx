import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { listCategoriesForAdmin } from "@/lib/data/categories";
import { listOffersForAdmin } from "@/lib/data/offers";
import { getHeroSlideForEdit } from "@/lib/data/hero";
import { HeroSlideForm } from "../hero-slide-form";

export const metadata: Metadata = { title: "Edit banner" };

export default async function EditHeroSlidePage({ params }: PageProps<"/admin/hero/[id]">) {
  await requireAdminView();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [slide, categories, offers] = await Promise.all([getHeroSlideForEdit(id), listCategoriesForAdmin(), listOffersForAdmin()]);
  if (!slide) notFound();

  return (
    <>
      <Link href="/admin/hero" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> Hero banners
      </Link>
      <PageHeader title="Edit banner" description={slide.isActive ? "On the homepage" : "Hidden"} />
      <HeroSlideForm
        initial={slide}
        categories={categories.map((c) => ({ name: c.name, slug: c.slug }))}
        offers={offers.map((o) => ({ title: o.title, slug: o.slug }))}
      />
    </>
  );
}
