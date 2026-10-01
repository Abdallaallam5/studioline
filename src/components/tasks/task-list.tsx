import { CalendarClock, ListChecks } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { HelpBadge, PriorityBadge, TaskStatusBadge } from "@/components/ui/badge";
import { Avatar, EmptyState } from "@/components/ui/primitives";
import { isOverdue } from "@/lib/tasks/workflow";
import { cn } from "@/lib/utils";
import type { TaskView } from "@/server/task-data";
import { getT } from "@/lib/i18n/server";

interface TaskListProps {
  items: TaskView[];
  /** "/workspace/tasks" for managers, "/my/tasks" for employees. */
  hrefBase: string;
  timezone: string;
  showAssignee?: boolean;
  /** Narrow columns: deadline moves under the title, priority is hidden. */
  compact?: boolean;
  empty?: { title: string; description?: string; action?: ReactNode };
}

export async function DeadlineLabel({ task, timezone, className }: { task: TaskView["task"]; timezone: string; className?: string }) {
  const t = await getT();
  const overdue = isOverdue(task);
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-xs", overdue ? "font-medium text-danger" : "text-muted", className)}>
      <CalendarClock className="size-3.5" />
      {task.deadline ? t.deadline(task.deadline, timezone) : t("No deadline")}
      {overdue && <span className="sr-only">{t("(overdue)")}</span>}
    </span>
  );
}

export async function TaskList({ items, hrefBase, timezone, showAssignee = true, compact, empty }: TaskListProps) {
  const t = await getT();
  if (items.length === 0) {
    return <EmptyState icon={<ListChecks />} title={empty?.title ?? t("No tasks")} description={empty?.description} action={empty?.action} />;
  }

  return (
    <ul className="divide-y divide-line">
      {items.map(({ task, project, assignee }) => (
        <li key={String(task._id)}>
          <Link href={`${hrefBase}/${task._id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-paper/70">
            {showAssignee && assignee && <Avatar name={assignee.name} size="sm" className="hidden sm:inline-flex" />}
            <div className="min-w-0 flex-1">
              <p dir="auto" className={cn("truncate text-sm font-medium", task.status === "CANCELLED" && "text-muted line-through")}>{task.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                {project && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-sm" style={{ backgroundColor: project.color }} aria-hidden />
                    {project.name}
                  </span>
                )}
                {showAssignee && assignee && <span>· {assignee.name}</span>}
                <DeadlineLabel task={task} timezone={timezone} className={compact ? undefined : "sm:hidden"} />
              </p>
            </div>
            <div className={cn("flex shrink-0 flex-col items-end gap-1.5", !compact && "sm:flex-row sm:items-center sm:gap-3")}>
              {task.helpRequested && <HelpBadge />}
              {!compact && (
                <>
                  <DeadlineLabel task={task} timezone={timezone} className="hidden sm:inline-flex" />
                  <span className="hidden w-16 md:block">
                    <PriorityBadge priority={task.priority} />
                  </span>
                </>
              )}
              <TaskStatusBadge status={task.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
