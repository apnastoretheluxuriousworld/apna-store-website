import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { getPaymentSettingsForAdmin } from "@/lib/data/checkout";
import { getStoreValuesForAdmin } from "@/lib/data/settings";
import { PaymentSettingsForm } from "./payment-settings-form";
import { StoreInfoForm } from "./store-info-form";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  await requireAdminView();
  const [values, payments] = await Promise.all([getStoreValuesForAdmin(), getPaymentSettingsForAdmin()]);
  return (
    <>
      <PageHeader title="Settings" description="Payments, delivery, contact details and social links." />
      <div className="space-y-8">
        <section id="payments" className="scroll-mt-24">
          <h2 className="mb-3 font-serif text-2xl text-ivory">Payments &amp; delivery</h2>
          <PaymentSettingsForm initial={payments} />
        </section>
        <section id="store">
          <h2 className="mb-3 font-serif text-2xl text-ivory">Store details</h2>
          <StoreInfoForm initial={values} />
        </section>
      </div>
    </>
  );
}
