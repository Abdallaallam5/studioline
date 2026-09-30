import { CircleCheck, Clock, Lock, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PaymentsTable } from "@/components/owner/payments-table";
import { AccountStatusBadge } from "@/components/ui/badge";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { BRAND } from "@/lib/brand";
import type { WorkspaceStatus } from "@/lib/constants";
import { daysUntil, suspensionDate } from "@/lib/subscription/status";
import { cn } from "@/lib/utils";
import { Payment, Subscription } from "@/models";
import { requireManager } from "@/server/context";
import { getPlatformSettings } from "@/server/subscription";
import { scope } from "@/server/tenant";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Subscription" };

export default async function AccountPage() {
  const t = await getT();
  // The one workspace page that stays reachable when the subscription is not active.
  const ctx = await requireManager({ allowRestricted: true });
  const [subscription, payments, settings] = await Promise.all([
    Subscription.findOne(scope(ctx)).lean(),
    Payment.find({ ...scope(ctx), voidedAt: null }).sort({ paidAt: -1 }).lean(),
    getPlatformSettings(),
  ]);
  const status = ctx.workspace.status;
  const renewal = subscription?.renewalDate;

  const explain: Record<WorkspaceStatus, { icon: ReactNode; tone: string; title: string; body: string }> = {
    PENDING_PAYMENT: {
      icon: <Clock />,
      tone: "bg-amber-50 text-amber-700",
      title: t("Your workspace is ready — waiting for activation"),
      body: t("Your account is verified and your workspace has been created. It unlocks as soon as our team confirms your subscription. We'll email you when it's live."),
    },
    ACTIVE: {
      icon: <CircleCheck />,
      tone: "bg-brand-soft text-brand",
      title: t("Your subscription is active"),
      body: renewal ? t("Next renewal on {date} (in {days}).", { date: t.date(renewal), days: t.n(Math.max(0, daysUntil(renewal)), "day") }) : "",
    },
    PAST_DUE: {
      icon: <TriangleAlert />,
      tone: "bg-amber-50 text-amber-700",
      title: t("Your payment is overdue"),
      body: renewal
        ? t("Renewal was due on {date}. Your workspace keeps working until {until}; after that it will be suspended until payment is received.", { date: t.date(renewal), until: t.date(suspensionDate(renewal, settings.gracePeriodDays)) })
        : "",
    },
    SUSPENDED: {
      icon: <Lock />,
      tone: "bg-danger-soft text-danger",
      title: t("Your workspace is suspended"),
      body: t("Your team can't access the workspace, and projects, tasks and invitations can't be created. Nothing has been deleted — all your projects, tasks and files are preserved and become available again as soon as the subscription is renewed."),
    },
    CANCELLED: {
      icon: <Lock />,
      tone: "bg-stone-100 text-stone-600",
      title: t("Your subscription was cancelled"),
      body: t("The workspace is no longer accessible. Your data has been preserved; contact us if you'd like to reactivate it."),
    },
  };
  const info = explain[status];

  return (
    <>
      <PageHeader title={t("Subscription")} description={t("Billing for {name}.", { name: ctx.workspace.name })} />
      <div className="max-w-3xl space-y-6">
        <Card className="p-5">
          <div className="flex gap-4">
            <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5", info.tone)}>{info.icon}</div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">{info.title}</h2>
                <AccountStatusBadge status={status} />
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{info.body}</p>
              {status !== "ACTIVE" && (
                <p className="mt-3 text-sm text-ink-soft">
                  {t("Questions about billing?")}{" "}
                  <a href={`mailto:${BRAND.supportEmail}`} className="font-medium text-brand hover:underline">
                    {BRAND.supportEmail}
                  </a>
                </p>
              )}
            </div>
          </div>
        </Card>

        {subscription && (
          <Card>
            <CardHeader title={t("Plan")} />
            <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-3">
              {[
                { label: t("Monthly price"), value: t.money(subscription.amountCents, settings.currency) },
                { label: t("Started"), value: t.date(subscription.startDate) },
                { label: subscription.cancelledAt ? t("Cancelled") : t("Next renewal"), value: t.date(subscription.cancelledAt ?? subscription.renewalDate) },
              ].map((item) => (
                <div key={item.label} className="bg-surface px-4 py-3.5">
                  <dt className="text-xs text-muted">{item.label}</dt>
                  <dd className="mt-1 text-[15px] font-semibold">{item.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        <Card>
          <CardHeader title={t("Payment history")} description={t("Payments are recorded by our team when they are received.")} />
          <PaymentsTable payments={payments} currency={settings.currency} />
        </Card>
      </div>
    </>
  );
}
