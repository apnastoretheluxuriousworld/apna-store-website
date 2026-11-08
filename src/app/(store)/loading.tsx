import { BrandLoader } from "@/components/ui/brand-loader";

// Shown while a store page streams in (e.g. a page that isn't cached yet).
export default function Loading() {
  return (
    <div className="grain flex min-h-[80svh] items-center justify-center overflow-hidden pt-24 pb-16">
      <BrandLoader />
    </div>
  );
}
