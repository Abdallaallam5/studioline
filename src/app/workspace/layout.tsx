import { Bell, CalendarDays, ClipboardCheck, CreditCard, FolderKanban, Kanban, LayoutDashboard, ListChecks, Settings, TriangleAlert, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { buttonClass } from "@/components/ui/button";
import { Callout } from "@/components/ui/primitives";
import { suspensionDate } from "@/lib/subscription/status";
import { Subscription, Task } from "@/models";
import { logout } from "@/server/actions/auth";
import { requireManager } from "@/server/context";
import { unreadCount } from "@/server/notifications";
import { getPlatformSettings } from "@/server/subscription";
import { scope } from "@/server/tenant";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: { default: "Workspace", template: "%s · Workspace" }, robots: { index: false } };

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  // Restricted managers still get the shell, but only the account page inside it.
  const ctx = await requireManager({ allowRestricted: true });
  const usable = ctx.access.workspace;

  const [unread, reviewCount, pastDue] = await Promise.all([
    unreadCount(ctx.user.id),
    usable ? Task.countDocuments({ ...scope(ctx), status: "SUBMITTED_FOR_REVIEW" }) : 0,
    ctx.workspace.status === "PAST_DUE" ? Promise.all([Subscription.findOne(scope(ctx)).lean(), getPlatformSettings()]) : null,
  ]);

  const banner =
    pastDue && pastDue[0] ? (
      <Callout
        tone="warn"
        icon={<TriangleAlert />}
        title={t("Your subscription payment is overdue")}
        action={
          <Link href="/workspace/account" className={buttonClass({ variant: "secondary", size: "sm" })}>
            {t("View account")}
          </Link>
        }
      >
        {t("Everything keeps working for now. The workspace will be suspended on")} {t.date(suspensionDate(pastDue[0].renewalDate, pastDue[1].gracePeriodDays))} {t("unless payment is received.")}
      </Callout>
    ) : undefined;

  return (
    <AppShell
      homeHref={usable ? "/workspace" : "/workspace/account"}
      contextLabel={ctx.workspace.name}
      user={{ name: ctx.user.name, email: ctx.user.email }}
      logoutAction={logout}
      notificationsHref={usable ? "/workspace/notifications" : undefined}
      unreadCount={unread}
      banner={banner}
      nav={
        usable
          ? [
              { href: "/workspace", label: t("Dashboard"), icon: <LayoutDashboard />, exact: true },
              { href: "/workspace/projects", label: t("Projects"), icon: <FolderKanban /> },
              { href: "/workspace/tasks", label: t("Tasks"), icon: <ListChecks /> },
              { href: "/workspace/board", label: t("Board"), icon: <Kanban /> },
              { href: "/workspace/calendar", label: t("Calendar"), icon: <CalendarDays /> },
              { href: "/workspace/team", label: t("Team"), icon: <Users /> },
              { href: "/workspace/review", label: t("Review"), icon: <ClipboardCheck />, badge: reviewCount },
              { href: "/workspace/notifications", label: t("Notifications"), icon: <Bell />, badge: unread },
            ]
          : [{ href: "/workspace/account", label: t("Account"), icon: <CreditCard /> }]
      }
      secondaryNav={
        usable
          ? [
              { href: "/workspace/settings", label: t("Settings"), icon: <Settings /> },
              { href: "/workspace/account", label: t("Subscription"), icon: <CreditCard /> },
            ]
          : undefined
      }
    >
      {children}
    </AppShell>
  );
}
