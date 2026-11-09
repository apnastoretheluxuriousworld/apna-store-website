import type { Metadata } from "next";

/*
 * The admin installs as its own app ("AS Admin"), separate from the store:
 * it opens on /admin and is where phone notifications are turned on.
 * iPhone only allows notifications from an app added to the Home Screen.
 */
export const metadata: Metadata = {
  manifest: "/admin.webmanifest",
  appleWebApp: { capable: true, title: "AS Admin", statusBarStyle: "black" },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
