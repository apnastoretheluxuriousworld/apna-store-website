import { ViewTransition } from "react";
import { Toaster } from "sonner";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { MenuProvider } from "@/components/layout/menu-context";
import { SiteHeader } from "@/components/layout/site-header";
import { MenuOverlay } from "@/components/layout/menu-overlay";
import { MobileBottomBar } from "@/components/layout/mobile-bottom-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { ReplyWatcher } from "@/components/feedback/reply-watcher";
import { getStoreCategories } from "@/lib/data/categories";
import { getStoreInfo } from "@/lib/data/settings";

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  // Cached + tagged: part of the static shell, refreshed when admin edits categories.
  const [categories, storeInfo] = await Promise.all([getStoreCategories(), getStoreInfo()]);

  return (
    <SmoothScroll>
      <MenuProvider>
        <SiteHeader categories={categories} />
        <MenuOverlay categories={categories} />
        <div className="pb-safe-bar lg:pb-0">
          {/* Route changes cross-fade via the browser View Transitions API.
              Links tagged transitionTypes={["tab"]} (the My Account tabs)
              swap in place without the page fade. */}
          <ViewTransition default={{ tab: "none", default: "page" }}>
            <main className="min-h-dvh">{children}</main>
          </ViewTransition>
          <SiteFooter categories={categories} info={storeInfo} />
        </div>
        <MobileBottomBar />
        {/* Signed-in customers: toast when the store replies to their feedback */}
        <ReplyWatcher />
        <Toaster
          theme="dark"
          position="top-center"
          offset={{ top: 72 }}
          mobileOffset={{ top: 72 }}
          toastOptions={{ style: { background: "#141414", border: "1px solid rgba(212,175,55,0.25)", color: "#f5f1e8" } }}
        />
      </MenuProvider>
    </SmoothScroll>
  );
}
