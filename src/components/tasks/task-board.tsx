"use client";

import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { HelpBadge, PriorityBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { TASK_STATUS_LABELS, type TaskPriority, type TaskStatus } from "@/lib/constants";
import { canManagerSetStatus } from "@/lib/tasks/workflow";
import { cn } from "@/lib/utils";
import { setTaskStatus } from "@/server/actions/tasks";
import { useT } from "@/lib/i18n/client";

export interface BoardTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadlineLabel: string | null;
  overdue: boolean;
  assigneeName: string;
  projectName: string;
  projectColor: string;
  helpRequested: boolean;
}

const COLUMNS: TaskStatus[] = ["NEW", "IN_PROGRESS", "BLOCKED", "SUBMITTED_FOR_REVIEW", "CHANGES_REQUESTED", "COMPLETED"];

export function TaskBoard({ tasks: initial, readOnly }: { tasks: BoardTask[]; readOnly?: boolean }) {
  const t = useT();
  // The card moves immediately; when the action settles, fresh server data takes
  // over (or the move is rolled back if it was rejected).
  const [tasks, moveOptimistically] = useOptimistic(initial, (current, change: { id: string; status: TaskStatus }) =>
    current.map((t) => (t.id === change.id ? { ...t, status: change.status } : t)),
  );
  const [dragging, setDragging] = useState<BoardTask | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [, startTransition] = useTransition();

  const canDrop = (status: TaskStatus) => Boolean(dragging) && canManagerSetStatus(dragging!.status, status);

  function move(task: BoardTask, status: TaskStatus) {
    startTransition(async () => {
      moveOptimistically({ id: task.id, status });
      const formData = new FormData();
      formData.set("taskId", task.id);
      formData.set("status", status);
      const result = await setTaskStatus(formData);
      if (!result.ok) toast.error(result.error ?? "Could not move the task.");
    });
  }

  return (
    <div className="scrollbar-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {COLUMNS.map((status) => {
        const column = tasks.filter((t) => t.status === status);
        const droppable = canDrop(status);
        return (
          <section
            key={status}
            aria-label={t(TASK_STATUS_LABELS[status])}
            onDragOver={(e) => {
              if (!droppable) return;
              e.preventDefault();
              setOver(status);
            }}
            onDragLeave={() => setOver((current) => (current === status ? null : current))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging && droppable) move(dragging, status);
              setDragging(null);
              setOver(null);
            }}
            className={cn(
              "flex w-[272px] shrink-0 flex-col rounded-xl border bg-ink/[0.025] transition-colors",
              over === status && droppable ? "border-brand bg-brand-soft/60" : "border-line",
              dragging && !droppable && dragging.status !== status && "opacity-50",
            )}
          >
            <header className="flex items-center justify-between px-3 py-2.5">
              <h2 className="text-[13px] font-semibold">{t(TASK_STATUS_LABELS[status])}</h2>
              <span className="rounded-full bg-ink/[0.06] px-1.5 text-[11px] tabular-nums text-ink-soft">{column.length}</span>
            </header>
            <ul className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
              {column.map((task) => (
                <li
                  key={task.id}
                  draggable={!readOnly}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", task.id);
                    setDragging(task);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  className={cn("rounded-lg border border-line bg-surface shadow-card", !readOnly && "cursor-grab active:cursor-grabbing", dragging?.id === task.id && "opacity-40")}
                >
                  <Link href={`/workspace/tasks/${task.id}`} draggable={false} className="block p-3">
                    <p className="flex items-center gap-1.5 text-xs text-muted">
                      <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: task.projectColor }} aria-hidden />
                      <span className="truncate">{task.projectName}</span>
                    </p>
                    <p className="mt-1.5 line-clamp-3 text-[13px] font-medium leading-snug">{task.title}</p>
                    {task.helpRequested && (
                      <p className="mt-2">
                        <HelpBadge />
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                        <Avatar name={task.assigneeName} size="sm" className="size-5 text-[9px]" />
                        <span className="truncate">{task.assigneeName.split(" ")[0]}</span>
                      </span>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    {task.deadlineLabel && (
                      <p className={cn("mt-2 flex items-center gap-1 text-xs", task.overdue ? "font-medium text-danger" : "text-muted")}>
                        <CalendarClock className="size-3.5" />
                        {task.deadlineLabel}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
              {column.length === 0 && <li className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line py-6 text-xs text-muted">{t("No tasks")}</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
