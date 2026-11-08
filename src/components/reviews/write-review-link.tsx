import Link from "next/link";
import { PenLine } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getReviewAction } from "@/lib/data/reviews";
import { buttonClass } from "@/components/ui/button";

/**
 * "Write a review" on the product page, only for a signed-in customer whose
 * order with this product has shipped. Reads the session, so render it
 * inside <Suspense>.
 */
export async function WriteReviewLink({ productId }: { productId: string }) {
  const user = await getCurrentUser();
  if (user?.role !== "customer") return null;
  const action = await getReviewAction(user.id, productId).catch(() => null);
  if (!action) return null;
  return (
    <Link href={`/account/reviews/${productId}`} className={buttonClass("outline", "md", "mt-6")}>
      <PenLine className="size-4" strokeWidth={1.5} />
      {action === "edit" ? "Edit your review" : "Write a review"}
    </Link>
  );
}
