import { Activity, Banknote, Building2, Inbox, LayoutDashboard, Repeat, Settings } from "lucide-react";
import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { RegistrationRequest } from "@/models";
import { logout } from "@/server/actions/auth";
import { requireOwner } from "@/server/context";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: { default: "Owner", template: "%s · Owner" }, robots: { index: false } };

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  const { user } = await requireOwner();
  const pending = await RegistrationRequest.countDocuments({ status: "PENDING_APPROVAL" });

  return (
    <AppShell
      homeHref="/owner"
      contextLabel={t("Platform owner")}
      user={{ name: user.name, email: user.email }}
      logoutAction={logout}
      nav={[
        { href: "/owner", label: t("Dashboard"), icon: <LayoutDashboard />, exact: true },
        { href: "/owner/requests", label: t("Registration requests"), icon: <Inbox />, badge: pending },
        { href: "/owner/managers", label: t("Project Managers"), icon: <Building2 /> },
        { href: "/owner/subscriptions", label: t("Subscriptions"), icon: <Repeat /> },
        { href: "/owner/payments", label: t("Payments"), icon: <Banknote /> },
        { href: "/owner/activity", label: t("Activity"), icon: <Activity /> },
      ]}
      secondaryNav={[{ href: "/owner/settings", label: t("Settings"), icon: <Settings /> }]}
    >
      {children}
    </AppShell>
  );
}
