import type { Metadata } from "next";
import { AccountForms } from "@/components/account-forms";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { updatePlatformSettings } from "@/server/actions/owner";
import { requireOwner } from "@/server/context";
import { getPlatformSettings } from "@/server/subscription";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Settings" };

export default async function OwnerSettingsPage() {
  const t = await getT();
  const { user } = await requireOwner();
  const settings = await getPlatformSettings();

  return (
    <>
      <PageHeader title={t("Settings")} description={t("Billing rules for the whole platform, and your own account.")} />
      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader title={t("Subscription rules")} description={t("Changes apply to every workspace immediately.")} />
          <ActionForm action={updatePlatformSettings} keepValues className="space-y-4 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("Grace period (days)")} name="gracePeriodDays" hint={t("How long a workspace stays usable after a missed renewal before it is suspended.")}>
                <Input name="gracePeriodDays" type="number" min={0} max={90} defaultValue={settings.gracePeriodDays} required />
              </Field>
              <Field label={t("“Renewing soon” window (days)")} name="renewalSoonDays" hint={t("Used for the dashboard and for renewal reminder emails.")}>
                <Input name="renewalSoonDays" type="number" min={1} max={60} defaultValue={settings.renewalSoonDays} required />
              </Field>
              <Field label={t("Default monthly price")} name="defaultPrice" hint={t("Pre-filled when you activate a new subscription.")}>
                <Input name="defaultPrice" inputMode="decimal" defaultValue={(settings.defaultPriceCents / 100).toFixed(2)} required />
              </Field>
              <Field label={t("Currency")} name="currency" hint={t("ISO code used for all amounts, e.g. USD, EUR, AED.")}>
                <Input name="currency" defaultValue={settings.currency} maxLength={3} className="uppercase" required />
              </Field>
            </div>
            <div className="flex justify-end">
              <SubmitButton>{t("Save rules")}</SubmitButton>
            </div>
          </ActionForm>
        </Card>
        <AccountForms user={user} />
      </div>
    </>
  );
}
