import { ArrowLeft } from "lucide-react";
import { isValidObjectId } from "mongoose";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityList } from "@/components/activity-list";
import { PaymentsTable } from "@/components/owner/payments-table";
import { ActivateSubscriptionModal, EditSubscriptionModal, RecordPaymentModal, SuspendModal } from "@/components/owner/subscription-modals";
import { ActionButton } from "@/components/ui/action-form";
import { AccountStatusBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { daysUntil, suspensionDate } from "@/lib/subscription/status";
import { ActivityLog, Payment } from "@/models";
import { cancelSubscription, createManagerResetLink, reinstateWorkspace, setWorkspaceDisabled } from "@/server/actions/owner";
import { PLATFORM_ACTIONS, type PlatformAction } from "@/server/activity";
import { requireOwner } from "@/server/context";
import { listManagers } from "@/server/owner-data";
import { getPlatformSettings } from "@/server/subscription";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Project Manager" };

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-end">{children}</dd>
    </div>
  );
}

export default async function ManagerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  await requireOwner();
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  const [[row], settings] = await Promise.all([listManagers({ workspaceId: id }), getPlatformSettings()]);
  if (!row) notFound();

  // Platform-scope entries only: billing and account events, never workspace content.
  const [payments, activity] = await Promise.all([
    Payment.find({ workspaceId: id }).sort({ paidAt: -1, createdAt: -1 }).lean(),
    ActivityLog.find({ scope: "PLATFORM", workspaceId: id }).sort({ createdAt: -1 }).limit(30).lean(),
  ]);
  const sub = row.subscription;
  const needsActivation = row.status === "PENDING_PAYMENT" || row.status === "CANCELLED";

  return (
    <>
      <Link href="/owner/managers" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="rtl:rotate-180 size-3.5" /> {t("Project Managers")}
      </Link>
      <PageHeader
        title={row.manager?.name ?? row.workspaceName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {row.workspaceName}
            <AccountStatusBadge status={row.status} />
            {row.disabled && <Badge tone="red">{t("Disabled")}</Badge>}
          </span>
        }
        actions={
          <>
            {needsActivation ? (
              <ActivateSubscriptionModal row={row} settings={settings} trigger={<Button>{t("Activate subscription")}</Button>} />
            ) : (
              <>
                <EditSubscriptionModal row={row} settings={settings} trigger={<Button variant="secondary">{t("Edit subscription")}</Button>} />
                <RecordPaymentModal rows={[row]} settings={settings} trigger={<Button>{t("Record payment")}</Button>} />
              </>
            )}
          </>
        }
      />

      <div className="space-y-3">
        {row.status === "PENDING_PAYMENT" && (
          <Callout tone="warn" title={t("Waiting for subscription")}>
            {t("The workspace exists but is locked until you activate a subscription.")}
          </Callout>
        )}
        {row.status === "PAST_DUE" && sub && (
          <Callout tone="warn" title={t("Payment overdue")}>
            {t("Renewal was due")} {t.date(sub.renewalDate)}{t(". The workspace will be suspended on")} {t.date(suspensionDate(sub.renewalDate, settings.gracePeriodDays))} {t("unless a payment is recorded.")}
          </Callout>
        )}
        {row.status === "SUSPENDED" && (
          <Callout tone="danger" title={row.manuallySuspended ? t("Suspended by you") : t("Suspended for non-payment")}>
            {row.manuallySuspended
              ? (row.suspendReason ?? t("No reason recorded."))
              : t("Renewal was due {date} and the {days} grace period has passed. Recording a payment restores access.", { date: sub ? t.date(sub.renewalDate) : "—", days: t.n(settings.gracePeriodDays, "day") })}
          </Callout>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("Account")} />
          <dl className="divide-y divide-line">
            <Detail label={t("Email")}>{row.manager?.email ?? "—"}</Detail>
            <Detail label={t("Phone")}>{row.manager?.phone ?? "—"}</Detail>
            <Detail label={t("Workspace")}>{row.workspaceName}</Detail>
            <Detail label={t("Employees")}>{row.employeeCount}</Detail>
            <Detail label={t("Projects")}>{row.projectCount}</Detail>
            <Detail label={t("Created")}>{t.date(row.createdAt)}</Detail>
          </dl>
        </Card>

        <Card>
          <CardHeader title={t("Subscription")} />
          {sub ? (
            <dl className="divide-y divide-line">
              <Detail label={t("Price")}>{t.money(sub.amountCents, settings.currency)} {t("/ month")}</Detail>
              <Detail label={t("Start date")}>{t.date(sub.startDate)}</Detail>
              <Detail label={t("Next renewal")}>
                {t.date(sub.renewalDate)}
                {row.status === "ACTIVE" && <span className="ms-1.5 text-muted">{t("in")} {t.n(Math.max(0, daysUntil(sub.renewalDate)), "day")}</span>}
              </Detail>
              <Detail label={t("Last payment")}>{row.lastPayment ? t("{amount} on {date}", { amount: t.money(row.lastPayment.amountCents, settings.currency), date: t.date(row.lastPayment.paidAt) }) : t("None recorded")}</Detail>
              {sub.cancelledAt && <Detail label={t("Cancelled")}>{t.date(sub.cancelledAt)}</Detail>}
              {sub.notes && (
                <div className="px-4 py-2.5 text-sm">
                  <dt className="text-muted">{t("Notes")}</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-ink-soft">{sub.notes}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="px-4 py-6 text-sm text-muted">{t("No subscription has been activated for this workspace.")}</p>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title={t("Payment history")} description={t("Records are permanent. Mistakes are voided, not deleted.")} />
        <PaymentsTable payments={payments} currency={settings.currency} canVoid />
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("Activity")} description={t("Billing and account events for this workspace")} />
          <ActivityList items={activity} label={(a) => PLATFORM_ACTIONS[a as PlatformAction]} />
        </Card>

        <Card className="h-fit">
          <CardHeader title={t("Account controls")} />
          <div className="divide-y divide-line">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <p className="text-sm font-medium">{row.manuallySuspended ? t("Lift suspension") : t("Suspend workspace")}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted">{t("Blocks the team from the workspace. Data is kept.")}</p>
              </div>
              {row.manuallySuspended ? (
                <ActionButton action={reinstateWorkspace} fields={{ workspaceId: row.workspaceId }} variant="secondary">
                  {t("Reinstate")}
                </ActionButton>
              ) : (
                <SuspendModal row={row} trigger={<Button variant="secondary">{t("Suspend")}</Button>} />
              )}
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <p className="text-sm font-medium">{t("Reset password")}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted">{t("Creates a one-time link you can send to the manager yourself.")}</p>
              </div>
              <ActionButton action={createManagerResetLink} fields={{ workspaceId: row.workspaceId }} variant="secondary">
                {t("Create link")}
              </ActionButton>
            </div>
            {sub && !sub.cancelledAt && (
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium">{t("Cancel subscription")}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted">{t("Ends billing. The workspace becomes inaccessible; data is kept.")}</p>
                </div>
                <ActionButton
                  action={cancelSubscription}
                  fields={{ workspaceId: row.workspaceId }}
                  variant="secondary"
                  confirm={t("Cancel the subscription for {name}? The team will lose access.", { name: row.workspaceName })}
                >
                  {t("Cancel")}
                </ActionButton>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <p className="text-sm font-medium">{row.disabled ? t("Enable account") : t("Disable account")}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted">
                  {row.disabled ? t("Allow the manager and employees to sign in again.") : t("Signs everyone out and blocks all sign-ins for this workspace.")}
                </p>
              </div>
              <ActionButton
                action={setWorkspaceDisabled}
                fields={{ workspaceId: row.workspaceId, disabled: row.disabled ? "false" : "true" }}
                variant={row.disabled ? "secondary" : "danger-ghost"}
                confirm={row.disabled ? undefined : t("Disable {name}? Everyone in this workspace will be signed out.", { name: row.workspaceName })}
              >
                {row.disabled ? t("Enable") : t("Disable")}
              </ActionButton>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
