import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, Prose } from "@/components/ui/info-page";
import { getCheckoutSettings } from "@/lib/data/checkout";
import { getStoreInfo } from "@/lib/data/settings";
import { formatPrice } from "@/lib/format";

/** Navigations here must show the page at once; `next dev` reports anything that blocks. */
export const instant = true;

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Cancellations, returns, exchanges and refunds at Apna Store.",
};

/** The return charge comes from Admin → Settings → Returns (same value shown at checkout). */
export default async function RefundPolicyPage() {
  const [{ returnFee }, info] = await Promise.all([getCheckoutSettings(), getStoreInfo()]);
  const phone = info.phones[0];
  const charge = returnFee > 0 ? formatPrice(returnFee) : null;

  return (
    <InfoPage
      eyebrow="Policies"
      title="Refund Policy"
      updated="9 November 2026"
      intro="We want you to love every piece. If something isn't right, here's how cancellations, returns and refunds work."
    >
      <Prose>
        <h2>Cancelling an order</h2>
        <ul>
          <li>You can cancel any order before it is dispatched — just contact us with your order number. There is no charge.</li>
          <li>Once an order has been dispatched it can&apos;t be cancelled, but you can return it as described below.</li>
          <li>If you paid online, the full amount is refunded for a cancelled order.</li>
        </ul>

        <h2>Damaged, defective or wrong items</h2>
        <ul>
          <li>Tell us within <strong>48 hours of delivery</strong> if a product arrives damaged, defective or different from what you ordered.</li>
          <li>Share clear photos and an unboxing video so we can sort it out quickly.</li>
          <li>We will arrange a replacement or a full refund — whichever you prefer, subject to stock. No return charge applies.</li>
        </ul>

        <h2>Changed your mind?</h2>
        <ul>
          <li>You can request a return within <strong>7 days of delivery</strong>.</li>
          <li>The item must be unused, in its original condition, with all tags, boxes, dust bags and warranty cards.</li>
          {charge ? (
            <li>
              A return charge of <strong>{charge}</strong> applies to these returns, to cover pickup and handling. It is deducted
              from your refund. The same charge is shown at checkout before you place your order.
            </li>
          ) : (
            <li>There is no return charge for these returns.</li>
          )}
          <li>Original shipping and cash-on-delivery charges are not refundable.</li>
        </ul>

        <h2>What can&apos;t be returned</h2>
        <ul>
          <li>Items that have been used, worn, altered or damaged after delivery.</li>
          <li>Items without their original packaging, tags or accessories.</li>
          <li>Opened perfumes and personal-care products, for hygiene reasons — unless they arrived damaged.</li>
          <li>Items bought on clearance or marked &ldquo;non-returnable&rdquo; on the product page.</li>
        </ul>

        <h2>How to request a return</h2>
        <ol>
          <li>
            Contact us
            {phone ? (
              <>
                {" "}
                on <a href={`tel:${phone.tel}`}>{phone.label}</a>
              </>
            ) : null}
            {info.whatsappUrl ? (
              <>
                {phone ? " or " : " on "}
                <a href={info.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </>
            ) : null}
            {info.email ? (
              <>
                {", or email "}
                <a href={`mailto:${info.email}`}>{info.email}</a>
              </>
            ) : null}{" "}
            with your order number and the reason for the return.
          </li>
          <li>We&apos;ll confirm whether the item is eligible and arrange a pickup, or share the address to send it to.</li>
          <li>Pack the item securely in its original packaging.</li>
          <li>Once it reaches us, we inspect it — usually within 2 working days — and let you know.</li>
        </ol>

        <h2>Refunds</h2>
        <ul>
          <li>Approved refunds go back to the original payment method. For cash-on-delivery orders we refund by UPI or bank transfer.</li>
          <li>Refunds are processed within 7–10 working days of approval. Your bank may take a few more days to show it.</li>
          {charge && <li>For change-of-mind returns, the {charge} return charge is deducted from the refund amount.</li>}
        </ul>

        <h2>Exchanges</h2>
        <p>
          Want a different size or colour? Contact us within 7 days of delivery. Exchanges depend on stock and follow the
          same conditions as returns.
        </p>

        <p>
          These terms are part of our <Link href="/terms">Terms &amp; Conditions</Link>. For anything else, please{" "}
          <Link href="/contact">get in touch</Link> — we&apos;re happy to help.
        </p>
      </Prose>
    </InfoPage>
  );
}
