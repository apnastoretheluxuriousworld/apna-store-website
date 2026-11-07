import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { requireAdminView } from "@/lib/auth/session";
import { listTestimonialsForAdmin } from "@/lib/data/testimonials";
import { TestimonialList } from "./testimonial-list";

export const metadata: Metadata = { title: "Testimonials" };

export default async function TestimonialsPage() {
  await requireAdminView();
  const rows = await listTestimonialsForAdmin();
  const shown = rows.filter((r) => r.isActive).length;

  return (
    <>
      <PageHeader
        title="Testimonials"
        description={`${shown} on the homepage${rows.length > shown ? ` · ${rows.length - shown} hidden` : ""} · drag to reorder`}
        actions={
          <ButtonLink href="/admin/testimonials/new" size="md">
            <Plus className="size-4" /> Add testimonial
          </ButtonLink>
        }
      />
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-600 py-16 text-center">
          <p className="text-sm text-stone">No testimonials yet. The homepage section stays hidden until you add one.</p>
          <Link href="/admin/testimonials/new" className="mt-3 inline-block text-sm text-gold-400 hover:underline">
            Add your first testimonial
          </Link>
        </div>
      ) : (
        <TestimonialList initial={rows} />
      )}
    </>
  );
}
