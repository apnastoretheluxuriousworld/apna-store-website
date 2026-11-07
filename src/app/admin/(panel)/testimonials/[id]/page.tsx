import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { getTestimonialForEdit, testimonialMedia } from "@/lib/data/testimonials";
import { TestimonialForm } from "../testimonial-form";

export const metadata: Metadata = { title: "Edit testimonial" };

export default async function EditTestimonialPage({ params }: PageProps<"/admin/testimonials/[id]">) {
  await requireAdminView();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const t = await getTestimonialForEdit(id);
  if (!t) notFound();
  const media = testimonialMedia(t);

  return (
    <>
      <Link href="/admin/testimonials" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> Testimonials
      </Link>
      <PageHeader title={t.name} description={t.isActive ? "On the homepage" : "Hidden"} />
      <TestimonialForm
        initial={{
          id: t.id,
          name: t.name,
          city: t.city ?? "",
          rating: t.rating,
          body: t.body ?? "",
          media: media ? [media] : [],
          isActive: t.isActive,
        }}
      />
    </>
  );
}
