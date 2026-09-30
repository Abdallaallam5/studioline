import { isValidObjectId } from "mongoose";
import type { Metadata } from "next";
import { TaskBoard, type BoardTask } from "@/components/tasks/task-board";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/primitives";
import { ACTIVE_TASK_STATUSES } from "@/lib/constants";
import { addDays } from "@/lib/dates";
import { isOverdue } from "@/lib/tasks/workflow";
import { requireManager } from "@/server/context";
import { findTasks, getTaskFormOptions } from "@/server/task-data";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ project?: string; assignee?: string }> }) {
  const t = await getT();
  const ctx = await requireManager();
  const params = await searchParams;
  const project = params.project && isValidObjectId(params.project) ? params.project : null;
  const assignee = params.assignee && isValidObjectId(params.assignee) ? params.assignee : null;
  const tz = ctx.workspace.timezone;
  const now = new Date();

  const [items, options] = await Promise.all([
    findTasks(
      ctx,
      {
        ...(project ? { projectId: project } : {}),
        ...(assignee ? { assigneeId: assignee } : {}),
        // Everything in flight, plus what was completed in the last two weeks.
        $or: [{ status: { $in: ACTIVE_TASK_STATUSES } }, { status: "COMPLETED", completedAt: { $gte: addDays(now, -14) } }],
      },
      { limit: 400 },
    ),
    getTaskFormOptions(ctx),
  ]);

  const tasks: BoardTask[] = items.map(({ task, project: p, assignee: a }) => ({
    id: String(task._id),
    title: task.title,
    status: task.status,
    priority: task.priority,
    deadlineLabel: task.deadline ? t.deadline(task.deadline, tz, now) : null,
    overdue: isOverdue(task, now),
    assigneeName: a?.name ?? t("Former member"),
    projectName: p?.name ?? t("Project"),
    projectColor: p?.color ?? "#78776f",
    helpRequested: task.helpRequested,
  }));

  return (
    <>
      <PageHeader
        title={t("Board")}
        description={t("Drag a card to update its status. Review outcomes are set from the task's review panel. Completed shows the last 14 days.")}
        actions={
          <form method="get" className="flex flex-wrap items-center gap-2">
            <Select name="project" defaultValue={project ?? ""} aria-label={t("Project")} className="w-40">
              <option value="">{t("All projects")}</option>
              {options.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select name="assignee" defaultValue={assignee ?? ""} aria-label={t("Assignee")} className="w-40">
              <option value="">{t("Everyone")}</option>
              {options.employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">
              {t("Filter")}
            </Button>
          </form>
        }
      />
      <TaskBoard tasks={tasks} readOnly={!ctx.access.write} />
    </>
  );
}
