import type { Metadata } from "next";
import { Suspense } from "react";
import { desc, eq } from "drizzle-orm";
import { CartSkeleton } from "@/components/cart/cart-view";
import { CheckoutView, type CheckoutPrefill } from "@/components/checkout/checkout-view";
import { getCurrentUser } from "@/lib/auth/session";
import { db, schema as s } from "@/lib/db";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-site px-4 pt-24 pb-16 lg:px-12 lg:pt-36">
      <header className="mb-8 text-center lg:mb-12">
        <p className="eyebrow">Secure checkout</p>
        <h1 className="mt-3 font-serif text-5xl font-light text-ivory lg:text-6xl">Checkout</h1>
        <div className="hairline mx-auto mt-6 w-24" />
      </header>
      <Suspense fallback={<CartSkeleton />}>
        <Checkout />
      </Suspense>
    </div>
  );
}

const blank = { fullName: "", phone: "", line1: "", line2: "", landmark: "", city: "", state: "", pincode: "" };

/** Signed-in customers start with their name, mobile and last-used address. */
async function Checkout() {
  const user = await getCurrentUser();
  let prefill: CheckoutPrefill = { signedIn: false, address: blank };
  if (user?.role === "customer") {
    const [a] = await db()
      .select()
      .from(s.addresses)
      .where(eq(s.addresses.userId, user.id))
      .orderBy(desc(s.addresses.isDefault), desc(s.addresses.createdAt))
      .limit(1);
    prefill = {
      signedIn: true,
      address: a
        ? { fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2 ?? "", landmark: a.landmark ?? "", city: a.city, state: a.state, pincode: a.pincode }
        : { ...blank, fullName: user.name, phone: user.phone ?? "" },
    };
  }
  return <CheckoutView prefill={prefill} />;
}
