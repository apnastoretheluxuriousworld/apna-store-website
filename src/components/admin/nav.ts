import {
  Clapperboard,
  FolderTree,
  LayoutDashboard,
  LayoutTemplate,
  Package,
  Quote,
  ReceiptText,
  Settings,
  Star,
  TicketPercent,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** shown in the mobile bottom bar (the rest live under "More") */
  primary?: boolean;
};

export const adminNav: AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, primary: true },
  { label: "Categories", href: "/admin/categories", icon: FolderTree, primary: true },
  { label: "Products", href: "/admin/products", icon: Package, primary: true },
  { label: "Orders", href: "/admin/orders", icon: ReceiptText, primary: true },
  { label: "Homepage", href: "/admin/homepage", icon: LayoutTemplate },
  { label: "Feed", href: "/admin/feed", icon: Clapperboard },
  { label: "Testimonials", href: "/admin/testimonials", icon: Quote },
  { label: "Coupons", href: "/admin/coupons", icon: TicketPercent },
  { label: "Reviews", href: "/admin/reviews", icon: Star },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}
