import type { Metadata } from "next";
import Link from "next/link";
import { ActivityList } from "@/components/activity-list";
import { TaskList } from "@/components/tasks/task-list";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { OPEN_TASK_STATUSES } from "@/lib/constants";
import { addDays, dayRange } from "@/lib/dates";
import { ActivityLog, Task } from "@/models";
import { requireEmployee } from "@/server/context";
import { findTasks } from "@/server/task-data";
import { scope, taskScope } from "@/server/tenant";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Home" };

export default async function EmployeeHomePage() {
  const t = await getT();
  const ctx = await requireEmployee();
  const tz = ctx.workspace.timezone;
  const now = new Date();
  const today = dayRange(tz, now);

  const [todayTasks, upcoming, inReview, myTaskIds] = await Promise.all([
    // "Today" = due today, plus anything overdue that still needs work.
    findTasks(ctx, { status: { $in: OPEN_TASK_STATUSES }, deadline: { $lt: today.end } }),
    findTasks(ctx, { status: { $in: OPEN_TASK_STATUSES }, deadline: { $gte: today.end, $lt: addDays(today.end, 7) } }, { limit: 6 }),
    findTasks(ctx, { status: "SUBMITTED_FOR_REVIEW" }, { limit: 6, sort: { submittedAt: -1 } }),
    Task.find(taskScope(ctx)).select("_id").lean(),
  ]);
  // Only activity on the employee's own tasks.
  const activity = await ActivityLog.find({ ...scope(ctx), scope: "WORKSPACE", taskId: { $in: myTaskIds.map((t) => t._id) } })
    .sort({ createdAt: -1 })
    .limit(8)
    .lean();

  return (
    <>
      <PageHeader
        title={t("{greeting}, {name}", { greeting: t.greeting(tz), name: ctx.user.name.split(" ")[0] })}
        description={todayTasks.length ? t("You have {tasks} to look at today.", { tasks: t.n(todayTasks.length, "task") }) : t("Nothing is due today.")}
        actions={
          <Link href="/my/tasks" className={buttonClass({ variant: "secondary" })}>
            {t("All my tasks")}
          </Link>
        }
      />

      <div className="stagger space-y-6">
        <Card>
          <CardHeader title={t("Today's tasks")} description={t("Due today or overdue")} />
          <TaskList items={todayTasks} hrefBase="/my/tasks" timezone={tz} showAssignee={false} empty={{ title: t("You're clear for today"), description: t("Check “Upcoming” to get ahead.") }} />
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title={t("Upcoming deadlines")} description={t("The next 7 days")} />
            <TaskList items={upcoming} hrefBase="/my/tasks" timezone={tz} showAssignee={false} compact empty={{ title: t("No deadlines this week") }} />
          </Card>
          <Card>
            <CardHeader title={t("Waiting for review")} description={t("Submitted — your manager will respond")} />
            <TaskList items={inReview} hrefBase="/my/tasks" timezone={tz} showAssignee={false} compact empty={{ title: t("Nothing waiting for review") }} />
          </Card>
        </div>

        <Card>
          <CardHeader title={t("Recent activity")} description={t("On your tasks")} />
          <ActivityList items={activity} timezone={tz} emptyText={t("Updates on your tasks will appear here.")} />
        </Card>
      </div>
    </>
  );
}
