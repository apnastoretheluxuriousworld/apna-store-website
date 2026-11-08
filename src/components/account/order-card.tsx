import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { formatDate } from "@/lib/orders";
import type { OrderListRow } from "@/lib/data/customers";
import { OrderStatusBadge } from "./order-status";

/** Overlapping photos of an order's first items. */
export function OrderThumbs({ images, size = 52 }: { images: string[]; size?: number }) {
  if (images.length === 0) {
    return (
      <span className="grid shrink-0 place-items-center rounded-lg border border-ink-600 bg-ink-900" style={{ width: size, height: size }}>
        <Package className="size-5 text-mute" strokeWidth={1.25} />
      </span>
    );
  }
  return (
    <span className="relative flex shrink-0" style={{ width: size + (images.length - 1) * 14, height: size }}>
      {images.map((src, i) => (
        <span
          key={src + i}
          className="absolute top-0 overflow-hidden rounded-lg border border-ink-600 bg-ink-900 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.8)]"
          style={{ left: i * 14, width: size, height: size, zIndex: images.length - i }}
        >
          <Image src={src} alt="" fill sizes={`${size}px`} className="object-cover" />
        </span>
      ))}
    </span>
  );
}

export function OrderCard({ order, href }: { order: OrderListRow; href: string }) {
  const more = order.itemCount - 1;
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-ink-600/80 bg-ink-850 p-4 transition-colors hover:border-gold-500/40"
    >
      <OrderThumbs images={order.images} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium tracking-wide text-ivory">#{order.orderNumber}</span>
          <OrderStatusBadge status={order.status} />
        </span>
        <span className="mt-1 block truncate text-xs text-stone">
          {order.firstItemName ?? "Order"}
          {more > 0 && ` + ${more} more`}
        </span>
        <span className="mt-0.5 block text-xs text-mute">Ordered {formatDate(order.createdAt)}</span>
      </span>
      <span className="text-right">
        <span className="block font-medium text-gold-300 tabular-nums">{formatPrice(order.total)}</span>
        <ChevronRight className="mt-1 ml-auto size-4 text-mute transition-transform group-hover:translate-x-0.5 group-hover:text-gold-400" />
      </span>
    </Link>
  );
}
