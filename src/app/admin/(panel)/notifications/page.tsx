import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { NotificationList } from "./notification-list";

export const metadata: Metadata = { title: "Notifications" };

/** The list itself is live in the browser (see components/admin/notifications.tsx). */
export default async function NotificationsPage() {
  await requireAdminView();
  return (
    <>
      <PageHeader title="Notifications" description="New orders, payments to verify, reviews and customer messages." />
      <NotificationList />
    </>
  );
}
