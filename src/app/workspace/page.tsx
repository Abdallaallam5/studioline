import { Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TaskFormModal } from "@/components/tasks/task-form";
import { TaskList } from "@/components/tasks/task-list";
import { Button, buttonClass } from "@/components/ui/button";
import { Avatar, Card, CardHeader, EmptyState, PageHeader, Stat, Table, Td, Th } from "@/components/ui/primitives";
import { env } from "@/lib/env";
import { requireManager } from "@/server/context";
import { getManagerDashboard, getTaskFormOptions, getTeamLoad, type TaskView } from "@/server/task-data";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Dashboard" };

async function AttentionCard({ title, description, items, timezone, emptyTitle, href }: { title: string; description: string; items: TaskView[]; timezone: string; emptyTitle: string; href: string }) {
  const t = await getT();
  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        action={
          items.length > 0 ? (
            <Link href={href} className={buttonClass({ variant: "ghost", size: "sm" })}>
              {t("View all")}
            </Link>
          ) : undefined
        }
      />
      <TaskList items={items} hrefBase="/workspace/tasks" timezone={timezone} empty={{ title: emptyTitle }} />
    </Card>
  );
}

export default async function ManagerDashboardPage() {
  const t = await getT();
  const ctx = await requireManager();
  const tz = ctx.workspace.timezone;
  const [dashboard, team, options] = await Promise.all([getManagerDashboard(ctx), getTeamLoad(ctx), getTaskFormOptions(ctx)]);
  const { counts } = dashboard;

  return (
    <>
      <PageHeader
        title={t("{greeting}, {name}", { greeting: t.greeting(tz), name: ctx.user.name.split(" ")[0] })}
        description={t("Here's what needs you today.")}
        actions={
          <TaskFormModal
            {...options}
            timezone={tz}
            maxUploadMb={env().MAX_UPLOAD_MB}
            trigger={
              <Button>
                <Plus /> {t("New task")}
              </Button>
            }
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Tasks today")} value={counts.dueToday} hint={t("Due before midnight")} href="/workspace/tasks?view=today" />
        <Stat label={t("In progress")} value={counts.inProgress} href="/workspace/tasks?status=IN_PROGRESS" />
        <Stat label={t("Waiting for review")} value={counts.waitingReview} href="/workspace/review" tone={counts.waitingReview ? "warn" : "default"} />
        <Stat label={t("Overdue")} value={counts.overdue} href="/workspace/tasks?view=overdue" tone={counts.overdue ? "danger" : "default"} />
      </div>

      <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-muted">{t("Needs your attention")}</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AttentionCard title={t("Overdue tasks")} description={t("Past their deadline and not submitted")} items={dashboard.overdue} timezone={tz} emptyTitle={t("Nothing is overdue")} href="/workspace/tasks?view=overdue" />
        <AttentionCard title={t("Waiting for review")} description={t("Submitted work that needs your decision")} items={dashboard.review} timezone={tz} emptyTitle={t("No submissions to review")} href="/workspace/review" />
        <AttentionCard title={t("Employees requesting help")} description={t("Open help requests, newest first")} items={dashboard.help} timezone={tz} emptyTitle={t("Nobody is blocked")} href="/workspace/tasks?view=help" />
        <AttentionCard title={t("Upcoming deadlines")} description={t("Due in the next 7 days")} items={dashboard.upcoming} timezone={tz} emptyTitle={t("No deadlines this week")} href="/workspace/calendar" />
      </div>

      <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-muted">{t("Team overview")}</h2>
      <Card>
        {team.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={t("No team members yet")}
            description={t("Invite your first employee to start assigning tasks.")}
            action={
              <Link href="/workspace/team" className={buttonClass({ size: "sm" })}>
                {t("Invite team")}
              </Link>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("Team member")}</Th>
                <Th className="text-end">{t("Active tasks")}</Th>
                <Th className="text-end">{t("Waiting for review")}</Th>
                <Th className="text-end">{t("Completed")}</Th>
              </tr>
            </thead>
            <tbody>
              {team.map((member) => (
                <tr key={member.id}>
                  <Td>
                    <Link href={`/workspace/tasks?assignee=${member.id}`} className="flex items-center gap-2.5 hover:text-brand">
                      <Avatar name={member.name} size="sm" />
                      <span>
                        <span className="block font-medium leading-tight">{member.name}</span>
                        {member.jobTitle && <span className="block text-xs text-muted">{member.jobTitle}</span>}
                      </span>
                    </Link>
                  </Td>
                  <Td className="text-end tabular-nums">{member.active}</Td>
                  <Td className="text-end tabular-nums">{member.inReview}</Td>
                  <Td className="text-end tabular-nums">{member.completed}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
