import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActivateSubscriptionModal, RecordPaymentModal } from "@/components/owner/subscription-modals";
import { AccountStatusBadge, Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { requireOwner } from "@/server/context";
import { listManagers } from "@/server/owner-data";
import { getPlatformSettings } from "@/server/subscription";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Project Managers" };

export default async function ManagersPage() {
  const t = await getT();
  await requireOwner();
  const [managers, settings] = await Promise.all([listManagers(), getPlatformSettings()]);

  return (
    <>
      <PageHeader title={t("Project Managers")} description={t("Every customer workspace, its subscription, and its size. Workspace content stays private to each team.")} />
      <Card>
        {managers.length === 0 ? (
          <EmptyState icon={<Building2 />} title={t("No Project Managers yet")} description={t("Approved applicants appear here once they verify their email and create a workspace.")} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("Project Manager")}</Th>
                <Th>{t("Workspace")}</Th>
                <Th>{t("Status")}</Th>
                <Th className="text-end">{t("Amount")}</Th>
                <Th>{t("Renewal")}</Th>
                <Th className="text-end">{t("Employees")}</Th>
                <Th className="text-end">{t("Projects")}</Th>
                <Th>{t("Created")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {managers.map((m) => (
                <tr key={m.workspaceId} className="hover:bg-paper/50">
                  <Td>
                    <Link href={`/owner/managers/${m.workspaceId}`} className="block">
                      <span className="block font-medium hover:text-brand">{m.manager?.name ?? "—"}</span>
                      <span className="block text-xs text-muted">{m.manager?.email}</span>
                    </Link>
                  </Td>
                  <Td>{m.workspaceName}</Td>
                  <Td>
                    <span className="flex items-center gap-1.5">
                      <AccountStatusBadge status={m.status} />
                      {m.disabled && <Badge tone="red">{t("Disabled")}</Badge>}
                    </span>
                  </Td>
                  <Td className="text-end tabular-nums">{m.subscription ? t.money(m.subscription.amountCents, settings.currency) : "—"}</Td>
                  <Td>{m.subscription ? t.date(m.subscription.renewalDate) : "—"}</Td>
                  <Td className="text-end tabular-nums">{m.employeeCount}</Td>
                  <Td className="text-end tabular-nums">{m.projectCount}</Td>
                  <Td className="text-muted">{t.date(m.createdAt)}</Td>
                  <Td>
                    <span className="flex justify-end gap-2">
                      {m.status === "PENDING_PAYMENT" || m.status === "CANCELLED" ? (
                        <ActivateSubscriptionModal row={m} settings={settings} trigger={<Button size="sm">{t("Activate")}</Button>} />
                      ) : (
                        <RecordPaymentModal
                          rows={[m]}
                          settings={settings}
                          trigger={
                            <Button size="sm" variant="secondary">
                              {t("Record payment")}
                            </Button>
                          }
                        />
                      )}
                      <Link href={`/owner/managers/${m.workspaceId}`} className={buttonClass({ size: "sm", variant: "ghost" })}>
                        {t("View")}
                      </Link>
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
