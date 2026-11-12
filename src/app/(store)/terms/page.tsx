import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, Prose } from "@/components/ui/info-page";

/** Navigations here must show the page at once; `next dev` reports anything that blocks. */
export const instant = true;

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms that apply when you browse and buy from Apna Store.",
};

export default function TermsPage() {
  return (
    <InfoPage eyebrow="Policies" title="Terms & Conditions" updated="8 November 2026" intro="Please read these terms before placing an order.">
      <Prose>
        <p>
          This website is run by Apna Store, Jama Masjid Complex, Chinna Bazar, Kothagudem, Telangana. By using the site
          or placing an order you agree to these terms and to our <Link href="/privacy">Privacy Policy</Link>.
        </p>

        <h2>Products</h2>
        <ul>
          <li>We describe and photograph every product as accurately as we can. Colours may look slightly different depending on your screen and lighting.</li>
          <li>Stock is limited. Products are reserved only when an order is confirmed.</li>
          <li>Brand names and trademarks shown belong to their respective owners.</li>
        </ul>

        <h2>Prices & payment</h2>
        <ul>
          <li>All prices are in Indian Rupees (₹) and include applicable taxes unless stated otherwise. Any delivery charge is shown before you pay.</li>
          <li>We accept online payments through our payment partner and, where offered, cash on delivery (COD). COD may require a minimum order value.</li>
          <li>If a product is listed at a wrong price because of an error, we may cancel the order and refund any amount paid in full.</li>
        </ul>

        <h2>Orders</h2>
        <ul>
          <li>An order is confirmed when you receive our confirmation. We may decline or cancel an order — for example if an item is out of stock, the address cannot be served, or we suspect misuse — and any amount paid will be refunded.</li>
          <li>We may call or message you on the number you provide to confirm a COD order before dispatch.</li>
        </ul>

        <h2>Delivery</h2>
        <p>
          We ship across India through courier partners. Delivery times shown are estimates and can vary with location,
          holidays and courier delays. Please check the package when it arrives; if the outer box is damaged or
          tampered with, note it with the courier or contact us right away.
        </p>

        <h2>Cancellations, returns & refunds</h2>
        <ul>
          <li>You can cancel an order before it is dispatched by contacting us.</li>
          <li>If you receive a damaged, defective or wrong item, tell us within 48 hours of delivery with photos and an unboxing video, and we will arrange a replacement or refund.</li>
          <li>Items must be unused, with original tags and packaging. For hygiene reasons, opened perfumes are not returnable unless they arrived damaged.</li>
          <li>Approved refunds are made to the original payment method (or by bank/UPI transfer for COD orders) within 7–10 working days.</li>
        </ul>

        <h2>Your account</h2>
        <p>
          Keep your login details private — you are responsible for orders placed from your account. Please give us
          accurate name, phone and address details so we can deliver.
        </p>

        <h2>Reviews</h2>
        <p>
          Reviews must be honest and about the product. We may decline or remove reviews that are abusive, misleading,
          unrelated or that share personal details.
        </p>

        <h2>Use of this website</h2>
        <p>
          The photos, text and design of this site belong to Apna Store and may not be copied for commercial use. Do not
          misuse the site, attempt to break its security or place fake orders.
        </p>

        <h2>Liability</h2>
        <p>
          To the extent the law allows, our liability for any order is limited to the amount you paid for it. Nothing
          in these terms limits your rights as a consumer under Indian law.
        </p>

        <h2>Governing law</h2>
        <p>
          These terms are governed by the laws of India. Any dispute is subject to the courts at Kothagudem, Telangana.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms? Reach us through the <Link href="/contact">Contact Us</Link> page.
        </p>
      </Prose>
    </InfoPage>
  );
}
