import type { Metadata } from "next";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminBottomBar, AdminMobileTop } from "@/components/admin/admin-mobile-nav";
import { PanelSkeleton } from "@/components/admin/ui";
import { OutboxStatus } from "@/components/admin/outbox";
import { NotificationsProvider, UnreadBadge } from "@/components/admin/notifications";
import { requireAdminView } from "@/lib/auth/session";
import { countPendingReviews } from "@/lib/data/reviews";
import { countUnreadConversations } from "@/lib/data/feedback";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Admin · Apna Store" },
  robots: { index: false, follow: false },
};

/** Gate for the panel content. Pages ALSO call requireAdminView() themselves. */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdminView();
  return children;
}

async function UserBadge() {
  const user = await requireAdminView();
  const initial = user.name.trim().charAt(0).toUpperCase() || "A";
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

/** Reviews waiting for approval: a count in the menu, or just a dot on "More". */
async function PendingReviews({ dot }: { dot?: boolean }) {
  await requireAdminView();
  const n = await countPendingReviews();
  if (!n) return null;
  if (dot) return <span aria-label="Reviews waiting" className="block size-2 rounded-full bg-gold-400" />;
  return (
    <span
      aria-label={`${n} waiting for approval`}
      className="grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1.5 text-[0.65rem] font-semibold text-ink-950 tabular-nums"
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** Conversations with customer messages the store hasn't read. */
async function UnreadFeedback() {
  await requireAdminView();
  const n = await countUnreadConversations();
  if (!n) return null;
  return (
    <span
      aria-label={`${n} unread conversation${n > 1 ? "s" : ""}`}
      className="grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1.5 text-[0.65rem] font-semibold text-ink-950 tabular-nums"
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

const navBadges = {
  "/admin/feedback": (
    <Suspense fallback={null}>
      <UnreadFeedback />
    </Suspense>
  ),
  "/admin/notifications": <UnreadBadge />,
  "/admin/reviews": (
    <Suspense fallback={null}>
      <PendingReviews />
    </Suspense>
  ),
};

/*
 * The <Suspense> boundaries below only cover a full page load. On a client
 * navigation this layout (and any folder the two URLs share) stays mounted and
 * only the deeper segments re-render, so every page folder has its own
 * loading.tsx (this same PanelSkeleton) that shows at once while requireAdminView()
 * and the page's queries run. Next checks this in dev and logs "encountered
 * uncached data during prerendering or a navigation" for a page folder without
 * one, so add one with every new admin page.
 *
 * Caching: pages read the session and the DB only through private-cached
 * helpers (requireAdminView, lib/data admin functions), so a visited page is
 * kept in the browser for the `admin` cacheLife profile (5 min) and shows
 * instantly when you come back. Admin Server Actions clear it. A new admin page
 * must do the same: any uncached request-time read makes it re-render on
 * every visit.
 */
export default function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <NotificationsProvider>
    <div className="min-h-dvh bg-ink-900 lg:pl-64">
      <AdminSidebar
        badges={navBadges}
        userSlot={
          <Suspense fallback={<div className="h-12" />}>
            <UserBadge />
          </Suspense>
        }
      />
      <AdminMobileTop />

      <main className="mx-auto max-w-site px-3 pt-[4.5rem] pb-28 sm:px-4 lg:px-8 lg:pt-8 lg:pb-12">
        <Suspense fallback={<PanelSkeleton />}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>

      <AdminBottomBar
        badges={navBadges}
        moreBadge={
          <Suspense fallback={null}>
            <PendingReviews dot />
          </Suspense>
        }
      />
      {/* Background sync of optimistic saves (see components/admin/outbox.tsx) */}
      {/* Suspense: it reads the URL (useRouter/usePathname), which can't be prerendered */}
      <Suspense fallback={null}>
        <OutboxStatus />
      </Suspense>
      <Toaster
        theme="dark"
        position="top-center"
        richColors
        toastOptions={{ style: { background: "#141414", border: "1px solid rgba(212,175,55,0.25)", color: "#f5f1e8" } }}
      />
    </div>
    </NotificationsProvider>
  );
}
