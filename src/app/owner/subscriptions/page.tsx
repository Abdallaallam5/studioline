import { Repeat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActivateSubscriptionModal, EditSubscriptionModal, RecordPaymentModal } from "@/components/owner/subscription-modals";
import { AccountStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, LinkTabs, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { WORKSPACE_STATUSES, type WorkspaceStatus } from "@/lib/constants";
import { daysUntil } from "@/lib/subscription/status";
import { cn } from "@/lib/utils";
import { requireOwner } from "@/server/context";
import { listManagers } from "@/server/owner-data";
import { getPlatformSettings } from "@/server/subscription";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Subscriptions" };

const FILTERS: { key: "ALL" | WorkspaceStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "PAST_DUE", label: "Past due" },
  { key: "SUSPENDED", label: "Suspended" },
  { key: "PENDING_PAYMENT", label: "Pending payment" },
  { key: "CANCELLED", label: "Cancelled" },
];

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const t = await getT();
  await requireOwner();
  const { status: raw } = await searchParams;
  const filter = (WORKSPACE_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as WorkspaceStatus) : "ALL";

  const [all, settings] = await Promise.all([listManagers(), getPlatformSettings()]);
  const rows = (filter === "ALL" ? all : all.filter((m) => m.status === filter)).sort(
    (a, b) => (a.subscription?.renewalDate.getTime() ?? Infinity) - (b.subscription?.renewalDate.getTime() ?? Infinity),
  );
  const mrr = all.filter((m) => m.status === "ACTIVE" || m.status === "PAST_DUE").reduce((sum, m) => sum + (m.subscription?.amountCents ?? 0), 0);

  return (
    <>
      <PageHeader
        title={t("Subscriptions")}
        description={t("One fixed monthly subscription per workspace. Status is derived automatically from the renewal date and a {days} grace period.", { days: t.n(settings.gracePeriodDays, "day") })}
        actions={<span className="text-sm text-muted">{t("Monthly recurring:")} <strong className="font-semibold text-ink">{t.money(mrr, settings.currency)}</strong></span>}
      />
      <LinkTabs
        active={filter}
        tabs={FILTERS.map((f) => ({
          key: f.key,
          label: t(f.label),
          href: f.key === "ALL" ? "/owner/subscriptions" : `/owner/subscriptions?status=${f.key}`,
          count: f.key === "ALL" ? all.length : all.filter((m) => m.status === f.key).length,
        }))}
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<Repeat />} title={t("No subscriptions here")} description={t("Nothing matches this filter.")} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("Project Manager")}</Th>
                <Th>{t("Workspace")}</Th>
                <Th className="text-end">{t("Price")}</Th>
                <Th>{t("Start date")}</Th>
                <Th>{t("Status")}</Th>
                <Th>{t("Last payment")}</Th>
                <Th>{t("Next renewal")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const days = m.subscription ? daysUntil(m.subscription.renewalDate) : null;
                return (
                  <tr key={m.workspaceId} className="hover:bg-paper/50">
                    <Td label={t("Project Manager")}>
                      <Link href={`/owner/managers/${m.workspaceId}`} className="font-medium hover:text-brand">
                        {m.manager?.name ?? "—"}
                      </Link>
                    </Td>
                    <Td label={t("Workspace")}>{m.workspaceName}</Td>
                    <Td label={t("Price")} className="text-end tabular-nums">{m.subscription ? t.money(m.subscription.amountCents, settings.currency) : "—"}</Td>
                    <Td label={t("Start date")}>{m.subscription ? t.date(m.subscription.startDate) : "—"}</Td>
                    <Td label={t("Status")}>
                      <AccountStatusBadge status={m.status} />
                    </Td>
                    <Td label={t("Last payment")}>{m.lastPayment ? t.date(m.lastPayment.paidAt) : "—"}</Td>
                    <Td label={t("Next renewal")}>
                      {m.subscription ? (
                        <>
                          {t.date(m.subscription.renewalDate)}
                          {days !== null && !m.subscription.cancelledAt && (
                            <span className={cn("ms-1.5 text-xs", days < 0 ? "text-danger" : "text-muted")}>{days < 0 ? t("{count} overdue", { count: t.n(-days, "day") }) : t("in {days}", { days: t.n(days, "day") })}</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <span className="flex justify-end gap-2">
                        {m.status === "PENDING_PAYMENT" || m.status === "CANCELLED" ? (
                          <ActivateSubscriptionModal row={m} settings={settings} trigger={<Button size="sm">{t("Activate")}</Button>} />
                        ) : (
                          <>
                            <EditSubscriptionModal
                              row={m}
                              settings={settings}
                              trigger={
                                <Button size="sm" variant="ghost">
                                  {t("Edit")}
                                </Button>
                              }
                            />
                            <RecordPaymentModal
                              rows={[m]}
                              settings={settings}
                              trigger={
                                <Button size="sm" variant="secondary">
                                  {t("Record payment")}
                                </Button>
                              }
                            />
                          </>
                        )}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
