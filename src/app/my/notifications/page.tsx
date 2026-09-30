import type { Metadata } from "next";
import { NotificationsView } from "@/components/notifications/notifications-view";
import { requireEmployee } from "@/server/context";

export const metadata: Metadata = { title: "Notifications" };

export default async function EmployeeNotificationsPage() {
  const ctx = await requireEmployee();
  return <NotificationsView userId={ctx.user.id} timezone={ctx.workspace.timezone} />;
}
