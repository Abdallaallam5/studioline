import "server-only";
import { ACTIVE_TASK_STATUSES, OPEN_TASK_STATUSES, type TaskStatus } from "@/lib/constants";
import { addDays, dayRange } from "@/lib/dates";
import { Project, Task, User, type ITask } from "@/models";
import type { WorkspaceContext } from "./context";
import { oid, scope, taskScope } from "./tenant";

/** A task plus the display names the UI needs, resolved within the tenant. */
export interface TaskView {
  task: ITask;
  project: { id: string; name: string; color: string } | null;
  assignee: { id: string; name: string; phone: string | null } | null;
}

export async function withRefs(ctx: WorkspaceContext, tasks: ITask[]): Promise<TaskView[]> {
  if (tasks.length === 0) return [];
  const [projects, users] = await Promise.all([
    Project.find({ _id: { $in: [...new Set(tasks.map((t) => String(t.projectId)))] }, ...scope(ctx) }).select("name color").lean(),
    User.find({ _id: { $in: [...new Set(tasks.map((t) => String(t.assigneeId)))] }, ...scope(ctx) }).select("name phone").lean(),
  ]);
  const projectMap = new Map(projects.map((p) => [String(p._id), { id: String(p._id), name: p.name, color: p.color }]));
  const userMap = new Map(users.map((u) => [String(u._id), { id: String(u._id), name: u.name, phone: u.phone ?? null }]));
  return tasks.map((task) => ({ task, project: projectMap.get(String(task.projectId)) ?? null, assignee: userMap.get(String(task.assigneeId)) ?? null }));
}

/** Tasks visible to the viewer, newest deadline pressure first. */
export async function findTasks(ctx: WorkspaceContext, filter: Record<string, unknown> = {}, opts: { limit?: number; sort?: Record<string, 1 | -1> } = {}): Promise<TaskView[]> {
  const tasks = await Task.find({ ...filter, ...taskScope(ctx) })
    .sort(opts.sort ?? { deadline: 1, createdAt: -1 })
    .limit(opts.limit ?? 200)
    .lean();
  // MongoDB sorts missing deadlines first; tasks without one belong at the end.
  if (!opts.sort) tasks.sort((a, b) => Number(!a.deadline) - Number(!b.deadline));
  return withRefs(ctx, tasks);
}

export async function getManagerDashboard(ctx: WorkspaceContext) {
  const now = new Date();
  const today = dayRange(ctx.workspace.timezone, now);
  const base = scope(ctx);

  const [dueToday, inProgress, waitingReview, overdueCount, overdue, review, help, upcoming] = await Promise.all([
    Task.countDocuments({ ...base, status: { $in: ACTIVE_TASK_STATUSES }, deadline: { $gte: today.start, $lt: today.end } }),
    Task.countDocuments({ ...base, status: "IN_PROGRESS" }),
    Task.countDocuments({ ...base, status: "SUBMITTED_FOR_REVIEW" }),
    Task.countDocuments({ ...base, status: { $in: OPEN_TASK_STATUSES }, deadline: { $lt: now } }),
    findTasks(ctx, { status: { $in: OPEN_TASK_STATUSES }, deadline: { $lt: now } }, { limit: 6 }),
    findTasks(ctx, { status: "SUBMITTED_FOR_REVIEW" }, { limit: 6, sort: { submittedAt: 1 } }),
    findTasks(ctx, { helpRequested: true, status: { $in: ACTIVE_TASK_STATUSES } }, { limit: 6, sort: { updatedAt: -1 } }),
    findTasks(ctx, { status: { $in: OPEN_TASK_STATUSES }, deadline: { $gte: now, $lt: addDays(now, 7) } }, { limit: 6 }),
  ]);

  return { counts: { dueToday, inProgress, waitingReview, overdue: overdueCount }, overdue, review, help, upcoming };
}

export interface TeamLoad {
  id: string;
  name: string;
  jobTitle: string | null;
  active: number;
  inReview: number;
  completed: number;
}

/** Workload per employee: task counts by state only — no time tracking or activity monitoring. */
export async function getTeamLoad(ctx: WorkspaceContext): Promise<TeamLoad[]> {
  const [employees, counts] = await Promise.all([
    User.find({ ...scope(ctx), role: "EMPLOYEE", disabledAt: null }).sort({ name: 1 }).lean(),
    Task.aggregate<{ _id: { assigneeId: unknown; status: TaskStatus }; count: number }>([
      { $match: { workspaceId: oid(ctx.workspace.id), status: { $ne: "CANCELLED" } } },
      { $group: { _id: { assigneeId: "$assigneeId", status: "$status" }, count: { $sum: 1 } } },
    ]),
  ]);

  return employees.map((e) => {
    const mine = counts.filter((c) => String(c._id.assigneeId) === String(e._id));
    const sum = (statuses: TaskStatus[]) => mine.filter((c) => statuses.includes(c._id.status)).reduce((n, c) => n + c.count, 0);
    return {
      id: String(e._id),
      name: e.name,
      jobTitle: e.jobTitle ?? null,
      active: sum(OPEN_TASK_STATUSES),
      inReview: sum(["SUBMITTED_FOR_REVIEW"]),
      completed: sum(["COMPLETED"]),
    };
  });
}

/** Options for the task form's project and assignee selects. */
export async function getTaskFormOptions(ctx: WorkspaceContext) {
  const [projects, employees] = await Promise.all([
    Project.find({ ...scope(ctx), status: { $ne: "ARCHIVED" } }).sort({ name: 1 }).select("name").lean(),
    User.find({ ...scope(ctx), role: "EMPLOYEE", disabledAt: null }).sort({ name: 1 }).select("name").lean(),
  ]);
  return {
    projects: projects.map((p) => ({ id: String(p._id), name: p.name })),
    employees: employees.map((e) => ({ id: String(e._id), name: e.name })),
  };
}
