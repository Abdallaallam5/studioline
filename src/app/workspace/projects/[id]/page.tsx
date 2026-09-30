import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { isValidObjectId } from "mongoose";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityList } from "@/components/activity-list";
import { ProjectFormModal } from "@/components/projects/project-form";
import { TaskFormModal } from "@/components/tasks/task-form";
import { TaskList } from "@/components/tasks/task-list";
import { ProjectStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, Card, CardHeader, PageHeader, Stat } from "@/components/ui/primitives";
import { OPEN_TASK_STATUSES } from "@/lib/constants";
import { env } from "@/lib/env";
import { isOverdue } from "@/lib/tasks/workflow";
import { ActivityLog, Project, User } from "@/models";
import { requireManager } from "@/server/context";
import { findTasks, getTaskFormOptions } from "@/server/task-data";
import { scope } from "@/server/tenant";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const ctx = await requireManager();
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  const project = await Project.findOne({ _id: id, ...scope(ctx) }).lean();
  if (!project) notFound();

  const tz = ctx.workspace.timezone;
  const [tasks, members, activity, options] = await Promise.all([
    findTasks(ctx, { projectId: id }, { limit: 500 }),
    User.find({ _id: { $in: project.memberIds }, ...scope(ctx) }).sort({ name: 1 }).select("name jobTitle disabledAt").lean(),
    ActivityLog.find({ ...scope(ctx), scope: "WORKSPACE", projectId: id }).sort({ createdAt: -1 }).limit(20).lean(),
    getTaskFormOptions(ctx),
  ]);

  const live = tasks.filter((t) => t.task.status !== "CANCELLED");
  const done = live.filter((t) => t.task.status === "COMPLETED").length;
  const percent = live.length ? Math.round((done / live.length) * 100) : 0;
  const open = live.filter((t) => t.task.status !== "COMPLETED");
  const overdue = open.filter((t) => isOverdue(t.task)).length;
  const inReview = live.filter((t) => t.task.status === "SUBMITTED_FOR_REVIEW").length;
  const deadlines = open.filter((t) => t.task.deadline && OPEN_TASK_STATUSES.includes(t.task.status)).slice(0, 6);
  const finished = tasks.filter((t) => t.task.status === "COMPLETED" || t.task.status === "CANCELLED");

  return (
    <>
      <Link href="/workspace/projects" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="rtl:rotate-180 size-3.5" /> {t("Projects")}
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: project.color }} aria-hidden />
            {project.name}
            <ProjectStatusBadge status={project.status} />
          </span>
        }
        description={[project.clientName, project.startDate || project.endDate ? `${t.date(project.startDate, tz)} – ${t.date(project.endDate, tz)}` : null].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <ProjectFormModal
              project={project}
              employees={options.employees}
              timezone={tz}
              trigger={
                <Button variant="secondary">
                  <Pencil /> {t("Edit")}
                </Button>
              }
            />
            <TaskFormModal
              {...options}
              timezone={tz}
              maxUploadMb={env().MAX_UPLOAD_MB}
              defaultProjectId={id}
              trigger={
                <Button>
                  <Plus /> {t("New task")}
                </Button>
              }
            />
          </>
        }
      />

      {/* Overview & progress */}
      <Card className="mb-6 p-4">
        {project.description && <p className="mb-4 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{project.description}</p>}
        <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
          <span className="font-medium">{t("Progress")}</span>
          <span className="tabular-nums text-muted">
            {done} {t("of")} {live.length} {t("tasks ·")} {percent}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ink/[0.07]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Open tasks")} value={open.length} />
        <Stat label={t("Waiting for review")} value={inReview} tone={inReview ? "warn" : "default"} />
        <Stat label={t("Overdue")} value={overdue} tone={overdue ? "danger" : "default"} />
        <Stat label={t("Completed")} value={done} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title={t("Tasks")} description={t("{count} open", { count: open.length })} />
            <TaskList items={open} hrefBase="/workspace/tasks" timezone={tz} empty={{ title: t("No open tasks"), description: t("Create a task to get this project moving.") }} />
          </Card>
          {finished.length > 0 && (
            <Card>
              <CardHeader title={t("Completed & cancelled")} />
              <TaskList items={finished} hrefBase="/workspace/tasks" timezone={tz} />
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title={t("Team")} />
            {members.length === 0 ? (
              <p className="px-4 py-5 text-[13px] text-muted">{t("No members yet. Assign a task or edit the project to add people.")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {members.map((m) => (
                  <li key={String(m._id)} className="flex items-center gap-2.5 px-4 py-2.5">
                    <Avatar name={m.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium leading-tight">{m.name}</p>
                      <p className="truncate text-xs text-muted">{m.disabledAt ? t("Deactivated") : (m.jobTitle ?? t("Team member"))}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t("Deadlines")} description={t("Next up in this project")} />
            <TaskList items={deadlines} hrefBase="/workspace/tasks" timezone={tz} showAssignee={false} compact empty={{ title: t("No upcoming deadlines") }} />
          </Card>

          <Card>
            <CardHeader title={t("Activity")} />
            <ActivityList items={activity} timezone={tz} />
          </Card>
        </aside>
      </div>
    </>
  );
}
