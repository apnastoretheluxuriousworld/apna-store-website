import { StorePageSkeleton } from "@/components/ui/skeleton";

// Shown while a store page that has no closer loading state streams in: the
// page outline in grey (title + product grid), never a full-page spinner.
export default function Loading() {
  return <StorePageSkeleton />;
}
