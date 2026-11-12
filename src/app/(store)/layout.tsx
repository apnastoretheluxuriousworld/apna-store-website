import { Suspense } from "react";
import { preconnect } from "react-dom";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { BrandSplash } from "@/components/brand/brand-splash";
import { MotionProvider } from "@/components/motion/motion-provider";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { MenuProvider } from "@/components/layout/menu-context";
import { SiteHeader } from "@/components/layout/site-header";
import { MenuOverlay } from "@/components/layout/menu-overlay";
import { MobileBottomBar } from "@/components/layout/mobile-bottom-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { WhatsappFab } from "@/components/layout/whatsapp-fab";
import { IdleExtras } from "@/components/layout/idle-extras";
import { NavProgress } from "@/components/layout/nav-progress";
import { VisitTracker } from "@/components/layout/visit-tracker";
import { getStoreCategories } from "@/lib/data/categories";
import { getStoreInfo } from "@/lib/data/settings";

/** Media bucket (R2) origin: the browser opens the connection early, before the first video/image request. */
function mediaOrigin() {
  try {
    return new URL(process.env.S3_PUBLIC_URL ?? "").origin;
  } catch {
    return null;
  }
}

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  // Cached + tagged: part of the static shell, refreshed when admin edits categories.
  const [categories, storeInfo] = await Promise.all([getStoreCategories(), getStoreInfo()]);
  const media = mediaOrigin();
  if (media) preconnect(media);

  return (
    <MotionProvider>
      {/* Once per app open: emblem + "Apna Store" for ~1.5 s while the page loads behind it */}
      <BrandSplash />
      <SmoothScroll>
        <MenuProvider>
          {/* Gold line at the top while a tapped page is still loading */}
          <Suspense fallback={null}>
            <NavProgress />
          </Suspense>
          <SiteHeader categories={categories} />
          <MenuOverlay categories={categories} />
          <div className="pb-safe-bar lg:pb-0">
            {/* No page cross-fade (<ViewTransition>): React holds each navigation
                until the new page's images load so it can animate, which made
                page changes ~280–600 ms instead of ~10–30 ms. */}
            <main className="min-h-dvh">{children}</main>
            <SiteFooter categories={categories} info={storeInfo} />
          </div>
          <MobileBottomBar />
          <WhatsappFab href={storeInfo.whatsappUrl} />
          {/* Reply notifications etc.: start once the browser is idle */}
          <IdleExtras />
          {/* Store traffic for the dashboard; reads the URL, so it streams in */}
          <Suspense fallback={null}>
            <VisitTracker />
          </Suspense>
          {/* Real-visitor speed (LCP, INP, TTFB per page) → Vercel dashboard → Speed Insights. Reads the URL, so it streams in. */}
          <Suspense fallback={null}>
            <SpeedInsights />
          </Suspense>
          <Toaster
            theme="dark"
            position="top-center"
            offset={{ top: 72 }}
            mobileOffset={{ top: 72 }}
            toastOptions={{ style: { background: "#141414", border: "1px solid rgba(212,175,55,0.25)", color: "#f5f1e8" } }}
          />
        </MenuProvider>
      </SmoothScroll>
    </MotionProvider>
  );
}
