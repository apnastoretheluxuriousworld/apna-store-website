import type { Metadata } from "next";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminBottomBar, AdminMobileTop } from "@/components/admin/admin-mobile-nav";
import { PanelSkeleton } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Admin · Apna Store" },
  robots: { index: false, follow: false },
};

/** Gate for the panel content. Pages ALSO call requireAdmin() themselves. */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

async function UserBadge({ compact }: { compact?: boolean }) {
  const user = await requireAdmin();
  const initial = user.name.trim().charAt(0).toUpperCase() || "A";
  if (compact) {
    return (
      <span className="flex items-center gap-2 text-stone">
        <span className="grid size-7 place-items-center rounded-full bg-gold-500/15 text-[0.7rem] font-semibold text-gold-300">
          {initial}
        </span>
      </span>
    );
  }
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span className="grid size-8 place-items-center rounded-full bg-gold-500/15 text-xs font-semibold text-gold-300">
        {initial}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm text-ivory">{user.name}</span>
        <span className="block truncate text-[0.7rem] text-mute">@{user.username ?? user.phone}</span>
      </span>
    </div>
  );
}

export default function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-dvh bg-ink-900 lg:pl-64">
      <AdminSidebar
        userSlot={
          <Suspense fallback={<div className="h-12" />}>
            <UserBadge />
          </Suspense>
        }
      />
      <AdminMobileTop
        userSlot={
          <Suspense fallback={null}>
            <UserBadge compact />
          </Suspense>
        }
      />

      <main className="mx-auto max-w-site px-4 pt-20 pb-28 lg:px-10 lg:pt-10 lg:pb-12">
        <Suspense fallback={<PanelSkeleton />}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>

      <AdminBottomBar />
      <Toaster
        theme="dark"
        position="top-center"
        richColors
        toastOptions={{ style: { background: "#141414", border: "1px solid rgba(212,175,55,0.25)", color: "#f5f1e8" } }}
      />
    </div>
  );
}
