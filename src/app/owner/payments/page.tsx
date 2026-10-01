import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { PaymentsTable } from "@/components/owner/payments-table";
import { RecordPaymentModal } from "@/components/owner/subscription-modals";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader, Stat } from "@/components/ui/primitives";
import { Payment } from "@/models";
import { requireOwner } from "@/server/context";
import { getRevenueSummary, listManagers } from "@/server/owner-data";
import { getPlatformSettings } from "@/server/subscription";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const t = await getT();
  await requireOwner();
  const [managers, settings, payments] = await Promise.all([listManagers(), getPlatformSettings(), Payment.find().sort({ paidAt: -1, createdAt: -1 }).limit(300).lean()]);
  const revenue = await getRevenueSummary(managers);
  const names = new Map(managers.map((m) => [m.workspaceId, m.workspaceName]));
  const { currency } = settings;

  return (
    <>
      <PageHeader
        title={t("Payments")}
        description={t("Payments are recorded by hand and kept permanently. All figures below are computed from these records.")}
        actions={
          <RecordPaymentModal
            rows={managers}
            settings={settings}
            trigger={
              <Button>
                <Plus /> {t("Record payment")}
              </Button>
            }
          />
        }
      />

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("This month")} value={t.money(revenue.currentMonthCents, currency)} />
        <Stat label={t("Last month")} value={t.money(revenue.previousMonthCents, currency)} />
        <Stat label={t("Total collected")} value={t.money(revenue.totalCollectedCents, currency)} />
        <Stat
          label={t("Outstanding")}
          value={t.money(revenue.outstandingCents, currency)}
          hint={revenue.outstandingCount ? t("{count} overdue", { count: t.n(revenue.outstandingCount, "workspace") }) : t("Nothing overdue")}
          tone={revenue.outstandingCount ? "danger" : "default"}
        />
      </div>

      <Card className="mt-6">
        <CardHeader title={t("Payment history")} description={t("Months are calendar months in UTC. Voided payments are excluded from totals.")} />
        <PaymentsTable payments={payments} currency={currency} workspaceNames={names} canVoid />
      </Card>
    </>
  );
}
