import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { TestimonialForm } from "../testimonial-form";

export const metadata: Metadata = { title: "Add testimonial" };

export default async function NewTestimonialPage() {
  await requireAdminView();
  return (
    <>
      <Link href="/admin/testimonials" className="mb-3 inline-flex items-center gap-1.5 text-xs text-mute hover:text-gold-400">
        <ArrowLeft className="size-3.5" /> Testimonials
      </Link>
      <PageHeader title="Add testimonial" description="Shown in “Loved by connoisseurs” on the homepage." />
      <TestimonialForm />
    </>
  );
}
