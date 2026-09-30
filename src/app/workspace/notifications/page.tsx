import type { Metadata } from "next";
import { NotificationsView } from "@/components/notifications/notifications-view";
import { requireManager } from "@/server/context";

export const metadata: Metadata = { title: "Notifications" };

export default async function ManagerNotificationsPage() {
  const ctx = await requireManager();
  return <NotificationsView userId={ctx.user.id} timezone={ctx.workspace.timezone} />;
}
