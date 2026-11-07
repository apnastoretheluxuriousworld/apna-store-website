import { ViewTransition } from "react";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { MenuProvider } from "@/components/layout/menu-context";
import { SiteHeader } from "@/components/layout/site-header";
import { MenuOverlay } from "@/components/layout/menu-overlay";
import { MobileBottomBar } from "@/components/layout/mobile-bottom-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { getStoreCategories } from "@/lib/data/categories";

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  // Cached + tagged: part of the static shell, refreshed when admin edits categories.
  const categories = await getStoreCategories();

  return (
    <SmoothScroll>
      <MenuProvider>
        <SiteHeader categories={categories} />
        <MenuOverlay categories={categories} />
        <div className="pb-safe-bar lg:pb-0">
          {/* Route changes cross-fade via the browser View Transitions API */}
          <ViewTransition default="page">
            <main className="min-h-dvh">{children}</main>
          </ViewTransition>
          <SiteFooter categories={categories} />
        </div>
        <MobileBottomBar />
      </MenuProvider>
    </SmoothScroll>
  );
}
