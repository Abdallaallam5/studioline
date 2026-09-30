import { Bell, CalendarClock, CircleCheck, Home, ListChecks, Sun, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { logout } from "@/server/actions/auth";
import { requireEmployee } from "@/server/context";
import { unreadCount } from "@/server/notifications";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: { default: "My work", template: "%s · My work" }, robots: { index: false } };

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  const ctx = await requireEmployee({ allowRestricted: true });
  const usable = ctx.access.workspace;
  const unread = usable ? await unreadCount(ctx.user.id) : 0;

  return (
    <AppShell
      homeHref={usable ? "/my" : "/my/paused"}
      contextLabel={ctx.workspace.name}
      user={{ name: ctx.user.name, email: ctx.user.email }}
      logoutAction={logout}
      notificationsHref={usable ? "/my/notifications" : undefined}
      unreadCount={unread}
      nav={
        usable
          ? [
              { href: "/my", label: t("Home"), icon: <Home />, exact: true },
              { href: "/my/tasks", label: t("My tasks"), icon: <ListChecks /> },
              { href: "/my/day", label: t("My day"), icon: <Sun /> },
              { href: "/my/upcoming", label: t("Upcoming"), icon: <CalendarClock /> },
              { href: "/my/completed", label: t("Completed"), icon: <CircleCheck /> },
              { href: "/my/notifications", label: t("Notifications"), icon: <Bell />, badge: unread },
            ]
          : []
      }
      secondaryNav={usable ? [{ href: "/my/profile", label: t("Profile"), icon: <UserRound /> }] : undefined}
    >
      {children}
    </AppShell>
  );
}
