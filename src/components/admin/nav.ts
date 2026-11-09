import {
  Bell,
  Clapperboard,
  Gift,
  GalleryHorizontal,
  FolderTree,
  LayoutDashboard,
  MessagesSquare,
  Package,
  Megaphone,
  Quote,
  ReceiptText,
  Settings,
  Star,
  TicketPercent,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Position in the mobile bottom bar (1–4); the rest live under "More". */
  primary?: number;
};

export const adminNav: AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, primary: 1 },
  { label: "Notifications", href: "/admin/notifications", icon: Bell, primary: 4 },
  { label: "Categories", href: "/admin/categories", icon: FolderTree },
  { label: "Products", href: "/admin/products", icon: Package, primary: 2 },
  { label: "Orders", href: "/admin/orders", icon: ReceiptText, primary: 3 },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Hero banners", href: "/admin/hero", icon: GalleryHorizontal },
  { label: "Feed", href: "/admin/feed", icon: Clapperboard },
  { label: "Testimonials", href: "/admin/testimonials", icon: Quote },
  { label: "Offers", href: "/admin/offers", icon: Gift },
  { label: "Coupons", href: "/admin/coupons", icon: TicketPercent },
  { label: "Influencers", href: "/admin/influencers", icon: Megaphone },
  { label: "Feedback", href: "/admin/feedback", icon: MessagesSquare },
  { label: "Reviews", href: "/admin/reviews", icon: Star },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}
