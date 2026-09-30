import { FolderKanban, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProjectFormModal } from "@/components/projects/project-form";
import { ProjectStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, LinkTabs, PageHeader } from "@/components/ui/primitives";
import { PROJECT_STATUS_LABELS, PROJECT_STATUSES, type ProjectStatus, type TaskStatus } from "@/lib/constants";
import { Project, Task } from "@/models";
import { requireManager } from "@/server/context";
import { getTaskFormOptions } from "@/server/task-data";
import { oid, scope } from "@/server/tenant";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const t = await getT();
  const ctx = await requireManager();
  const { status: raw } = await searchParams;
  const status = (PROJECT_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as ProjectStatus) : null;
  const tz = ctx.workspace.timezone;

  const [projects, taskCounts, options] = await Promise.all([
    // Archived projects only appear under their own tab.
    Project.find({ ...scope(ctx), status: status ?? { $ne: "ARCHIVED" } }).sort({ createdAt: -1 }).lean(),
    Task.aggregate<{ _id: { projectId: unknown; status: TaskStatus }; count: number }>([
      { $match: { workspaceId: oid(ctx.workspace.id), status: { $ne: "CANCELLED" } } },
      { $group: { _id: { projectId: "$projectId", status: "$status" }, count: { $sum: 1 } } },
    ]),
    getTaskFormOptions(ctx),
  ]);

  const stats = (projectId: string) => {
    const rows = taskCounts.filter((c) => String(c._id.projectId) === projectId);
    const total = rows.reduce((n, r) => n + r.count, 0);
    const done = rows.filter((r) => r._id.status === "COMPLETED").reduce((n, r) => n + r.count, 0);
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  };

  const newProject = (
    <ProjectFormModal
      employees={options.employees}
      timezone={tz}
      trigger={
        <Button>
          <Plus /> {t("New project")}
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader title={t("Projects")} description={t("Group tasks by client, campaign, or retainer.")} actions={newProject} />
      <LinkTabs
        active={status ?? "CURRENT"}
        tabs={[{ key: "CURRENT", label: t("Current"), href: "/workspace/projects" }, ...PROJECT_STATUSES.map((s) => ({ key: s, label: t(PROJECT_STATUS_LABELS[s]), href: `/workspace/projects?status=${s}` }))]}
      />

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban />}
            title={status ? t("No {status} projects", { status: t(PROJECT_STATUS_LABELS[status]).toLowerCase() }) : t("Create your first project")}
            description={status ? undefined : t("Projects hold the tasks, team, and deadlines for one piece of client work.")}
            action={status ? undefined : newProject}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const s = stats(String(project._id));
            return (
              <Link key={String(project._id)} href={`/workspace/projects/${project._id}`} className="group block">
                <Card className="flex h-full flex-col p-4 transition-colors group-hover:border-line-strong">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: project.color }} aria-hidden />
                      <h2 className="truncate text-[15px] font-semibold">{project.name}</h2>
                    </div>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  <p className="mt-1 truncate text-[13px] text-muted">{project.clientName || t("No client")}</p>

                  <div className="mt-auto pt-5">
                    <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted">
                      <span>
                        {s.done} {t("of")} {t.n(s.total, "task")} {t("done")}
                      </span>
                      <span className="tabular-nums">{s.percent}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink/[0.07]" role="progressbar" aria-valuenow={s.percent} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-brand" style={{ width: `${s.percent}%` }} />
                    </div>
                    <p className="mt-3 text-xs text-muted">
                      {t.n(project.memberIds.length, "member")}
                      {project.endDate ? ` · ${t("Ends {date}", { date: t.date(project.endDate, tz) })}` : ""}
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
