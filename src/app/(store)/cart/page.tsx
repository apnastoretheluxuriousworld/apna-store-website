import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-site px-4 pt-20 pb-16 lg:px-12 lg:pt-32">
      <h1 className="sr-only">Cart</h1>
      <CartView />
    </div>
  );
}
