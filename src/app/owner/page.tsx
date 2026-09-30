import { CalendarClock, CircleDollarSign, Inbox } from "lucide-react";
import Link from "next/link";
import { ActivityList } from "@/components/activity-list";
import { AccountStatusBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui/primitives";
import { daysUntil } from "@/lib/subscription/status";
import { ActivityLog } from "@/models";
import { PLATFORM_ACTIONS, type PlatformAction } from "@/server/activity";
import { requireOwner } from "@/server/context";
import { getOwnerDashboard } from "@/server/owner-data";
import { getT } from "@/lib/i18n/server";

export default async function OwnerDashboardPage() {
  const t = await getT();
  const { user } = await requireOwner();
  const [data, activity] = await Promise.all([getOwnerDashboard(), ActivityLog.find({ scope: "PLATFORM" }).sort({ createdAt: -1 }).limit(8).lean()]);
  const { currency } = data.settings;
  const delta = data.revenue.currentMonthCents - data.revenue.previousMonthCents;

  return (
    <>
      <PageHeader title={t("{greeting}, {name}", { greeting: t.greeting("UTC"), name: user.name.split(" ")[0] })} description={t("How the platform is doing today.")} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Project Managers")} value={data.totalManagers} href="/owner/managers" />
        <Stat label={t("Active subscriptions")} value={data.activeSubscriptions} href="/owner/subscriptions" />
        <Stat label={t("Pending requests")} value={data.pendingRequests.length} href="/owner/requests" tone={data.pendingRequests.length ? "warn" : "default"} />
        <Stat label={t("Suspended accounts")} value={data.suspendedAccounts} href="/owner/managers" tone={data.suspendedAccounts ? "danger" : "default"} />
        <Stat
          label={t("Revenue this month")}
          value={t.money(data.revenue.currentMonthCents, currency)}
          hint={t("{delta} vs last month", { delta: `${delta >= 0 ? "+" : "−"}${t.money(Math.abs(delta), currency)}` })}
          href="/owner/payments"
        />
        <Stat
          label={t("Payments due")}
          value={data.paymentsDue.length}
          hint={data.paymentsDue.length ? t("{amount} outstanding", { amount: t.money(data.revenue.outstandingCents, currency) }) : t("Nothing overdue")}
          tone={data.paymentsDue.length ? "danger" : "default"}
          href="/owner/subscriptions"
        />
        <Stat label={t("Renewals coming soon")} value={data.renewalsSoon.length} hint={t("Next {days}", { days: t.n(data.settings.renewalSoonDays, "day") })} href="/owner/subscriptions" />
        <Stat label={t("Total collected")} value={t.money(data.revenue.totalCollectedCents, currency)} hint={t("All recorded payments")} href="/owner/payments" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t("Registration requests")}
            description={t("Waiting for your decision")}
            action={
              <Link href="/owner/requests" className={buttonClass({ variant: "ghost", size: "sm" })}>
                {t("Review")}
              </Link>
            }
          />
          {data.pendingRequests.length === 0 ? (
            <EmptyState icon={<Inbox />} title={t("No pending requests")} description={t("New access requests appear here for approval.")} />
          ) : (
            <ul className="divide-y divide-line">
              {data.pendingRequests.slice(0, 5).map((r) => (
                <li key={String(r._id)} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.fullName}</p>
                    <p className="truncate text-xs text-muted">
                      {r.company} · {r.teamSize} {t("people")}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{t.ago(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={t("Payments due")} description={t("Past due or suspended for non-payment")} />
          {data.paymentsDue.length === 0 ? (
            <EmptyState icon={<CircleDollarSign />} title={t("All subscriptions are paid up")} />
          ) : (
            <ul className="divide-y divide-line">
              {data.paymentsDue.map((m) => (
                <li key={m.workspaceId}>
                  <Link href={`/owner/managers/${m.workspaceId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper/70">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.workspaceName}</p>
                      <p className="truncate text-xs text-muted">
                        {t.money(m.subscription!.amountCents, currency)} {t("· due")} {t.date(m.subscription!.renewalDate)}
                      </p>
                    </div>
                    <AccountStatusBadge status={m.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={t("Renewals coming soon")} description={t("Within {days}", { days: t.n(data.settings.renewalSoonDays, "day") })} />
          {data.renewalsSoon.length === 0 ? (
            <EmptyState icon={<CalendarClock />} title={t("No renewals in this window")} />
          ) : (
            <ul className="divide-y divide-line">
              {data.renewalsSoon.map((m) => (
                <li key={m.workspaceId}>
                  <Link href={`/owner/managers/${m.workspaceId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper/70">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.workspaceName}</p>
                      <p className="truncate text-xs text-muted">{m.manager?.name}</p>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="text-sm tabular-nums">{t.money(m.subscription!.amountCents, currency)}</p>
                      <p className="text-xs text-muted">{t("in")} {t.n(Math.max(0, daysUntil(m.subscription!.renewalDate)), "day")}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title={t("Recent activity")}
            action={
              <Link href="/owner/activity" className={buttonClass({ variant: "ghost", size: "sm" })}>
                {t("View all")}
              </Link>
            }
          />
          <ActivityList items={activity} label={(a) => PLATFORM_ACTIONS[a as PlatformAction]} />
        </Card>
      </div>
    </>
  );
}
