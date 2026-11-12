import { cn } from "@/lib/utils";

/*
 * Page-shaped loading placeholders. Each one copies the size and spacing of the
 * real page, so when the content arrives nothing jumps (no layout shift).
 * The gold sheen and fade-in live in globals.css under "Skeletons".
 * No hooks: usable from server and client components alike.
 */

/** One grey block. Give it the size of the thing it stands in for. */
export function Skel({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skel rounded-md", className)} />;
}

/** Screen-reader announcement for the whole placeholder. */
function Busy({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Same box as ProductCard: image, name, price, "Add to bag". */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gold-500/10 bg-ink-800/70">
      <Skel className="aspect-6/5 rounded-none sm:aspect-square" />
      <div className="flex flex-1 flex-col p-2.5 lg:p-3">
        <Skel className="h-3 w-3/4" />
        <Skel className="mt-2 h-3.5 w-1/3" />
        <Skel className="mt-3 h-9 w-full lg:h-10" />
      </div>
    </div>
  );
}

/** Product grid as on a collection page. */
export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4 xl:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Centered page title block (eyebrow, big serif title, line). */
function TitleSkeleton() {
  return (
    <div className="mb-8 flex flex-col items-center lg:mb-12">
      <Skel className="h-2.5 w-20" />
      <Skel className="mt-4 h-11 w-56 lg:h-14 lg:w-72" />
      <Skel className="mt-4 h-3 w-64 max-w-full" />
      <div className="hairline mx-auto mt-6 w-24" />
    </div>
  );
}

/** Collection page (/shop/[category]): title, count, grid. Goes inside the page's padded container. */
export function CategorySkeleton() {
  return (
    <Busy label="Loading collection">
      <TitleSkeleton />
      <Skel className="mb-4 h-2.5 w-16" />
      <ProductGridSkeleton />
    </Busy>
  );
}

/** Product page: gallery on the left, name/price/buttons on the right. */
export function ProductDetailSkeleton() {
  return (
    <Busy label="Loading product" className="mx-auto max-w-site lg:px-12">
      <div className="hidden pb-5 lg:block">
        <Skel className="h-2.5 w-64" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
        <Skel className="aspect-8/5 rounded-none sm:rounded-2xl lg:aspect-4/5" />
        <div className="px-4 lg:px-0 lg:pt-2">
          <Skel className="h-2.5 w-24" />
          <Skel className="mt-3 h-8 w-4/5 lg:h-12" />
          <Skel className="mt-6 h-7 w-32" />
          <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
            <Skel className="h-12" />
            <Skel className="h-12" />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skel key={i} className="h-14 rounded-lg" />
            ))}
          </div>
          <Skel className="mt-8 h-3 w-full" />
          <Skel className="mt-2 h-3 w-11/12" />
          <Skel className="mt-2 h-3 w-2/3" />
        </div>
      </div>
    </Busy>
  );
}

/** Combo offer page: cover image on the left, title/price/picker on the right. */
export function OfferSkeleton() {
  return (
    <Busy label="Loading offer" className="mx-auto max-w-site lg:px-12">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-12">
        <Skel className="aspect-4/5 max-h-[70svh] w-full rounded-none sm:mx-auto sm:max-w-md sm:rounded-2xl lg:max-h-none lg:max-w-none" />
        <div className="px-4 lg:px-0">
          <Skel className="h-2.5 w-16" />
          <Skel className="mt-3 h-10 w-3/4" />
          <Skel className="mt-4 h-8 w-40" />
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </Busy>
  );
}

/** Cart: item rows on the left, order summary on the right. */
export function CartSkeleton() {
  return (
    <Busy label="Loading your cart" className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-10">
      <div>
        <Skel className="mb-3 h-2.5 w-16" />
        <div className="space-y-3">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex gap-3 rounded-2xl border border-ink-600/80 bg-ink-850 p-3 sm:gap-4 sm:p-4">
              <Skel className="aspect-4/5 w-20 shrink-0 rounded-lg sm:w-24" />
              <div className="flex-1">
                <Skel className="h-3 w-2/3" />
                <Skel className="mt-2 h-3 w-1/4" />
                <Skel className="mt-5 h-8 w-28" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-ink-600/80 bg-ink-850 p-5">
        <Skel className="h-3 w-1/3" />
        <Skel className="mt-5 h-3 w-full" />
        <Skel className="mt-3 h-3 w-full" />
        <Skel className="mt-3 h-4 w-full" />
        <Skel className="mt-6 h-12 w-full" />
      </div>
    </Busy>
  );
}

/** Account tabs' content: summary cards and a couple of order cards. */
export function AccountSkeleton() {
  return (
    <Busy label="Loading your account" className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Skel className="h-20 rounded-2xl" />
        <Skel className="h-20 rounded-2xl" />
      </div>
      {Array.from({ length: 2 }, (_, i) => (
        <Skel key={i} className="h-32 rounded-2xl" />
      ))}
    </Busy>
  );
}

/** Generic store page (title + grid): the fallback when a whole store page is still loading. */
export function StorePageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("mx-auto max-w-site px-4 pt-24 pb-16 lg:px-12 lg:pt-36", className)}>
      <Busy label="Loading">
        <TitleSkeleton />
        <ProductGridSkeleton />
      </Busy>
    </div>
  );
}
