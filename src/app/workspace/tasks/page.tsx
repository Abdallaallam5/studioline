import { Plus, Search } from "lucide-react";
import { isValidObjectId } from "mongoose";
import type { Metadata } from "next";
import Link from "next/link";
import { TaskFormModal } from "@/components/tasks/task-form";
import { TaskList } from "@/components/tasks/task-list";
import { Button, buttonClass } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, LinkTabs, PageHeader } from "@/components/ui/primitives";
import { ACTIVE_TASK_STATUSES, OPEN_TASK_STATUSES, TASK_STATUS_LABELS, TASK_STATUSES, type TaskStatus } from "@/lib/constants";
import { dayRange } from "@/lib/dates";
import { env } from "@/lib/env";
import { requireManager } from "@/server/context";
import { findTasks, getTaskFormOptions } from "@/server/task-data";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Tasks" };

const VIEWS = [
  { key: "open", label: "Open" },
  { key: "today", label: "Due today" },
  { key: "overdue", label: "Overdue" },
  { key: "help", label: "Help requested" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
] as const;
type View = (typeof VIEWS)[number]["key"];

type Params = { view?: string; status?: string; assignee?: string; project?: string; q?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Params> }) {
  const t = await getT();
  const ctx = await requireManager();
  const params = await searchParams;
  const tz = ctx.workspace.timezone;
  const now = new Date();

  const view: View = VIEWS.some((v) => v.key === params.view) ? (params.view as View) : "open";
  const status = (TASK_STATUSES as readonly string[]).includes(params.status ?? "") ? (params.status as TaskStatus) : null;
  const assignee = params.assignee && isValidObjectId(params.assignee) ? params.assignee : null;
  const project = params.project && isValidObjectId(params.project) ? params.project : null;
  const q = params.q?.trim().slice(0, 100) ?? "";

  const today = dayRange(tz, now);
  const byView: Record<View, Record<string, unknown>> = {
    open: { status: { $in: ACTIVE_TASK_STATUSES } },
    today: { status: { $in: ACTIVE_TASK_STATUSES }, deadline: { $gte: today.start, $lt: today.end } },
    overdue: { status: { $in: OPEN_TASK_STATUSES }, deadline: { $lt: now } },
    help: { helpRequested: true, status: { $in: ACTIVE_TASK_STATUSES } },
    completed: { status: "COMPLETED" },
    all: {},
  };

  const filter: Record<string, unknown> = {
    ...byView[view],
    ...(status ? { status } : {}),
    ...(assignee ? { assigneeId: assignee } : {}),
    ...(project ? { projectId: project } : {}),
    // The search text is escaped, so it is matched literally rather than as a pattern.
    ...(q ? { title: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } } : {}),
  };

  const [items, options] = await Promise.all([
    findTasks(ctx, filter, view === "completed" ? { sort: { completedAt: -1 } } : view === "all" ? { sort: { createdAt: -1 } } : {}),
    getTaskFormOptions(ctx),
  ]);

  const keep = { ...(assignee ? { assignee } : {}), ...(project ? { project } : {}), ...(q ? { q } : {}) };
  const hasFilters = Boolean(status || assignee || project || q);

  return (
    <>
      <PageHeader
        title={t("Tasks")}
        description={t("Every task in the workspace. Filter by project, person, or status.")}
        actions={
          <TaskFormModal
            {...options}
            timezone={tz}
            maxUploadMb={env().MAX_UPLOAD_MB}
            defaultProjectId={project ?? undefined}
            trigger={
              <Button>
                <Plus /> {t("New task")}
              </Button>
            }
          />
        }
      />

      <LinkTabs active={view} tabs={VIEWS.map((v) => ({ key: v.key, label: t(v.label), href: `/workspace/tasks?${new URLSearchParams({ view: v.key, ...keep })}` }))} />

      <form method="get" className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_170px_170px_170px_auto]">
        <input type="hidden" name="view" value={view} />
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input name="q" defaultValue={q} placeholder={t("Search tasks…")} className="ps-9" aria-label={t("Search tasks")} />
        </div>
        <Select name="project" defaultValue={project ?? ""} aria-label={t("Project")}>
          <option value="">{t("All projects")}</option>
          {options.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select name="assignee" defaultValue={assignee ?? ""} aria-label={t("Assignee")}>
          <option value="">{t("Everyone")}</option>
          {options.employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={status ?? ""} aria-label={t("Status")}>
          <option value="">{t("Any status")}</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(TASK_STATUS_LABELS[s])}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary">
            {t("Filter")}
          </Button>
          {hasFilters && (
            <Link href={`/workspace/tasks?view=${view}`} className={buttonClass({ variant: "ghost" })}>
              {t("Clear")}
            </Link>
          )}
        </div>
      </form>

      <Card>
        <TaskList
          items={items}
          hrefBase="/workspace/tasks"
          timezone={tz}
          empty={hasFilters ? { title: t("No tasks match these filters"), description: t("Try clearing a filter or switching tabs.") } : { title: t("No tasks here"), description: view === "open" ? t("Create a task to get your team moving.") : undefined }}
        />
      </Card>
      {items.length >= 200 && <p className="mt-3 text-center text-xs text-muted">{t("Showing the first 200 tasks. Narrow the filters to see more.")}</p>}
    </>
  );
}
