import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage, Prose } from "@/components/ui/info-page";
import { getStoreInfo } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Apna Store collects, uses and protects your personal information.",
};

export default async function PrivacyPage() {
  const info = await getStoreInfo();
  const reach = [info.email, info.phones[0]?.label].filter(Boolean).join(" or ");
  return (
    <InfoPage eyebrow="Policies" title="Privacy Policy" updated="8 November 2026" intro="What we collect, why we collect it, and how we keep it safe.">
      <Prose>
        <p>
          This policy explains how Apna Store (“we”, “us”), Jama Masjid Complex, Chinna Bazar, Kothagudem, Telangana,
          handles your personal data when you use this website or buy from us. It is written in line with India’s Digital
          Personal Data Protection Act, 2023 and the Information Technology Act, 2000.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Account and contact details</strong> — your name, mobile number and email when you create an account or place an order.</li>
          <li><strong>Delivery details</strong> — the addresses you save or ship to.</li>
          <li><strong>Orders</strong> — what you bought, when, the amount and its status.</li>
          <li><strong>Reviews</strong> — ratings, text, photos and videos you choose to post.</li>
          <li><strong>Basic technical data</strong> — device and browser type and pages visited, used to keep the site secure and working.</li>
        </ul>
        <p>
          We do not see or store your card, UPI or bank details. Online payments are handled directly by our payment
          partner over a secure connection.
        </p>

        <h2>How we use it</h2>
        <ul>
          <li>To process, pack, ship and deliver your orders, and to collect payment (including cash on delivery).</li>
          <li>To contact you about your order by call, SMS, WhatsApp or email.</li>
          <li>To manage your account and bag, and to provide after-sales support.</li>
          <li>To prevent fraud and misuse, and to meet legal, tax and accounting obligations.</li>
          <li>With your consent, to tell you about new arrivals and offers — you can opt out at any time.</li>
        </ul>

        <h2>Who we share it with</h2>
        <p>We never sell your data. We share only what is needed with:</p>
        <ul>
          <li>Courier and delivery partners — your name, phone and address, to deliver your order.</li>
          <li>Our payment partner — to process online payments.</li>
          <li>Hosting and storage providers that run this website for us, under confidentiality.</li>
          <li>Government or law-enforcement authorities, when the law requires it.</li>
        </ul>

        <h2>Cookies</h2>
        <p>
          We use essential cookies to keep you signed in and remember your bag. We do not use advertising
          cookies. Blocking cookies in your browser may stop sign-in and checkout from working.
        </p>

        <h2>How long we keep it</h2>
        <p>
          We keep your account details while your account is active, and order records for as long as tax and
          accounting laws require (generally up to 8 years). When data is no longer needed it is deleted or anonymised.
        </p>

        <h2>Keeping it safe</h2>
        <p>
          Your data is sent over encrypted connections (HTTPS), passwords are stored only in hashed form, and access is
          limited to the people who run the store. No system is perfectly secure, but we take reasonable care to protect
          your information.
        </p>

        <h2>Your rights</h2>
        <p>
          You can ask us to show, correct or delete your personal data, withdraw consent for marketing, or close your
          account. We may need to keep order records the law requires us to hold.
        </p>

        <h2>Contact & grievances</h2>
        <p>
          For any privacy question or complaint, contact us{reach ? ` at ${reach}` : ""} or through the{" "}
          <Link href="/contact">Contact Us</Link> page. We aim to respond within 7 days.
        </p>

        <h2>Changes to this policy</h2>
        <p>If we change this policy, we will update it on this page with a new “last updated” date.</p>
      </Prose>
    </InfoPage>
  );
}
