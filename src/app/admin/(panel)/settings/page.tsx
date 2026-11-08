import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { requireAdminView } from "@/lib/auth/session";
import { getPaymentSettingsForAdmin } from "@/lib/data/checkout";
import { getStoreValuesForAdmin } from "@/lib/data/settings";
import { AdminPasswordForm } from "./admin-password-form";
import { PaymentSettingsForm } from "./payment-settings-form";
import { StoreInfoForm } from "./store-info-form";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  const admin = await requireAdminView();
  const [values, payments] = await Promise.all([getStoreValuesForAdmin(), getPaymentSettingsForAdmin()]);
  return (
    <>
      <PageHeader title="Settings" description="Payments, delivery, contact details, social links and your password." />
      <div className="space-y-8">
        <section id="payments" className="scroll-mt-24">
          <h2 className="mb-3 font-serif text-2xl text-ivory">Payments &amp; delivery</h2>
          <PaymentSettingsForm initial={payments} />
        </section>
        <section id="store">
          <h2 className="mb-3 font-serif text-2xl text-ivory">Store details</h2>
          <StoreInfoForm initial={values} />
        </section>
        <section id="password" className="scroll-mt-24">
          <h2 className="mb-3 font-serif text-2xl text-ivory">Security</h2>
          <AdminPasswordForm username={admin.username ?? ""} />
        </section>
      </div>
    </>
  );
}
