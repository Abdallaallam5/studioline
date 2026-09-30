import { Bell, CheckCheck } from "lucide-react";
import { ActionButton } from "@/components/ui/action-form";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { Notification } from "@/models";
import { markAllNotificationsRead } from "@/server/actions/workspace";
import { NotificationLink } from "./notification-link";
import { getT } from "@/lib/i18n/server";

/** Notification inbox for the signed-in user. Queries are always scoped to `userId`. */
export async function NotificationsView({ userId, timezone }: { userId: string; timezone: string }) {
  const t = await getT();
  const items = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title={t("Notifications")}
        description={unread ? `${t.n(unread, "unread notification")}.` : t("You're all caught up.")}
        actions={
          unread > 0 ? (
            <ActionButton action={markAllNotificationsRead} variant="secondary">
              <CheckCheck /> {t("Mark all as read")}
            </ActionButton>
          ) : undefined
        }
      />
      <Card>
        {items.length === 0 ? (
          <EmptyState icon={<Bell />} title={t("No notifications yet")} description={t("Assignments, submissions, reviews and help requests will show up here.")} />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={String(n._id)}>
                <NotificationLink id={String(n._id)} href={n.href ?? null} unread={!n.readAt} className={cn("flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-paper/70", !n.readAt && "bg-brand-soft/40")}>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm leading-snug", !n.readAt && "font-medium")}>{t.msg(n.titleT, n.title)}</span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-muted">{t.msg(n.bodyT, n.body)}</span>}
                  </span>
                  <time className="shrink-0 text-xs text-muted" dateTime={n.createdAt.toISOString()} title={t.dateTime(n.createdAt, timezone)}>
                    {t.ago(n.createdAt)}
                  </time>
                </NotificationLink>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
