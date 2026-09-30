import type { Metadata } from "next";
import Link from "next/link";
import { ActivityList } from "@/components/activity-list";
import { buttonClass } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { ActivityLog } from "@/models";
import { PLATFORM_ACTIONS, type PlatformAction } from "@/server/activity";
import { requireOwner } from "@/server/context";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Activity" };

const PAGE_SIZE = 50;

const GROUPS: { key: string; label: string; actions: PlatformAction[] }[] = [
  { key: "registrations", label: "Registrations", actions: ["MANAGER_REGISTERED", "MANAGER_APPROVED", "MANAGER_REJECTED", "WORKSPACE_CREATED"] },
  { key: "billing", label: "Billing", actions: ["SUBSCRIPTION_ACTIVATED", "SUBSCRIPTION_UPDATED", "SUBSCRIPTION_CANCELLED", "PAYMENT_RECORDED", "PAYMENT_VOIDED"] },
  { key: "accounts", label: "Accounts", actions: ["ACCOUNT_STATUS_CHANGED", "ACCOUNT_SUSPENDED", "ACCOUNT_REINSTATED", "ACCOUNT_DISABLED", "ACCOUNT_ENABLED"] },
  { key: "teams", label: "Team size", actions: ["EMPLOYEE_COUNT_CHANGED"] },
];

export default async function OwnerActivityPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  const t = await getT();
  await requireOwner();
  const { type, page: rawPage } = await searchParams;
  const group = GROUPS.find((g) => g.key === type);
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);

  // The owner only ever reads PLATFORM-scope entries: operational events, no workspace content.
  const items = await ActivityLog.find({ scope: "PLATFORM", ...(group ? { action: { $in: group.actions } } : {}) })
    .sort({ createdAt: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE + 1)
    .lean();
  const hasMore = items.length > PAGE_SIZE;
  const href = (p: number) => `/owner/activity?${new URLSearchParams({ ...(group ? { type: group.key } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <>
      <PageHeader title={t("Activity")} description={t("Operational events across the platform: registrations, billing, and account changes. Workspace content is never shown here.")} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[{ key: undefined, label: t("All") }, ...GROUPS].map((g) => (
          <Link
            key={g.label}
            href={g.key ? `/owner/activity?type=${g.key}` : "/owner/activity"}
            className={cn(
              "rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
              group?.key === g.key ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink-soft hover:border-ink/40",
            )}
          >
            {t(g.label)}
          </Link>
        ))}
      </div>
      <Card>
        <ActivityList items={items.slice(0, PAGE_SIZE)} label={(a) => PLATFORM_ACTIONS[a as PlatformAction]} emptyText={t("Platform events will be listed here as they happen.")} />
      </Card>
      {(page > 1 || hasMore) && (
        <div className="mt-4 flex justify-between">
          {page > 1 ? (
            <Link href={href(page - 1)} className={buttonClass({ variant: "secondary", size: "sm" })}>
              {t("Newer")}
            </Link>
          ) : (
            <span />
          )}
          {hasMore && (
            <Link href={href(page + 1)} className={buttonClass({ variant: "secondary", size: "sm" })}>
              {t("Older")}
            </Link>
          )}
        </div>
      )}
    </>
  );
}
