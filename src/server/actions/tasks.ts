"use server";

import { msg } from "@/lib/i18n/config";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { HELP_REASON_LABELS, HELP_REASONS, REVIEW_DECISIONS, TASK_PRIORITIES, TASK_STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import { formatDeadline, parseLocalDateTime } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { emailTemplates } from "@/lib/email/templates";
import { appUrl } from "@/lib/env";
import { canEmployee, canManager, canManagerSetStatus, managerTarget } from "@/lib/tasks/workflow";
import type { ActionState } from "@/lib/utils";
import { Comment, FileAsset, HelpRequest, Project, Submission, Task, User, type ITask } from "@/models";
import { ActionError, parseForm, requireEmployeeWrite, requireManagerWrite, run, zId, zIdList, zOptionalText } from "../action-utils";
import { logWorkspace } from "../activity";
import { requireMember, type WorkspaceContext } from "../context";
import { notify } from "../notifications";
import { claimUploads, findTaskOrThrow, scope, taskScope } from "../tenant";

const managerTaskUrl = (id: unknown) => `/workspace/tasks/${id}`;
const employeeTaskUrl = (id: unknown) => `/my/tasks/${id}`;

function refresh() {
  revalidatePath("/workspace", "layout");
  revalidatePath("/my", "layout");
}

/** Members may act on a task only while the subscription permits writes. */
async function requireMemberWrite(): Promise<WorkspaceContext> {
  const ctx = await requireMember();
  if (!ctx.access.write) throw new ActionError("This workspace is read-only right now.");
  return ctx;
}

/* ─── Create / edit (manager) ────────────────────────────────────────── */

const taskSchema = z.object({
  title: z.string().trim().min(2, "Enter a task title").max(200),
  description: zOptionalText(10000),
  projectId: zId,
  assigneeId: zId,
  deadline: z.string().optional(),
  priority: z.enum(TASK_PRIORITIES),
  tags: z.string().max(400).optional(),
  checklist: z.string().max(6000).optional(),
  fileIds: zIdList,
});

async function toTaskFields(ctx: WorkspaceContext, data: z.infer<typeof taskSchema>) {
  const [project, assignee] = await Promise.all([
    Project.findOne({ _id: data.projectId, ...scope(ctx) }).lean(),
    User.findOne({ _id: data.assigneeId, ...scope(ctx), role: "EMPLOYEE", disabledAt: null }).lean(),
  ]);
  if (!project) throw new z.ZodError([{ code: "custom", path: ["projectId"], message: "Select a project", input: data.projectId }]);
  if (!assignee) throw new z.ZodError([{ code: "custom", path: ["assigneeId"], message: "Select an active team member", input: data.assigneeId }]);

  let deadline: Date | null = null;
  if (data.deadline) {
    deadline = parseLocalDateTime(data.deadline, ctx.workspace.timezone);
    if (!deadline) throw new z.ZodError([{ code: "custom", path: ["deadline"], message: "Enter a valid deadline", input: data.deadline }]);
  }

  const tags = [...new Set((data.tags ?? "").split(",").map((t) => t.trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 10);
  const checklist = (data.checklist ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, 50);

  return { project, assignee, deadline, tags, checklist };
}

async function notifyAssignment(ctx: WorkspaceContext, task: ITask, projectName: string, assignee: { _id: unknown; name: string; email: string; locale?: string | null }) {
  const deadline = formatDeadline(task.deadline, ctx.workspace.timezone);
  await notify({
    userId: String(assignee._id),
    workspaceId: ctx.workspace.id,
    type: "TASK_ASSIGNED",
    title: msg("New task: {title}", { title: task.title }),
    body: `${projectName} · ${deadline}`,
    href: employeeTaskUrl(task._id),
  });
  await sendEmail({
    to: assignee.email,
    ...emailTemplates.taskAssigned(assignee.locale, { name: assignee.name, title: task.title, projectName, deadline: task.deadline, timezone: ctx.workspace.timezone, taskUrl: appUrl(employeeTaskUrl(task._id)) }),
  });
}

export async function createTask(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireManagerWrite();
    const data = parseForm(taskSchema, formData);
    const { project, assignee, deadline, tags, checklist } = await toTaskFields(ctx, data);

    const task = await Task.create({
      ...scope(ctx),
      projectId: project._id,
      title: data.title,
      description: data.description,
      assigneeId: assignee._id,
      deadline,
      priority: data.priority,
      tags,
      checklist: checklist.map((text) => ({ text, done: false })),
      createdBy: ctx.user.id,
    });
    await claimUploads(ctx, data.fileIds, String(task._id));
    await Task.updateOne({ _id: task._id }, { $set: { attachmentIds: [...new Set(data.fileIds)] } });
    await Project.updateOne({ _id: project._id, ...scope(ctx) }, { $addToSet: { memberIds: assignee._id } });

    await logWorkspace(ctx.workspace.id, "TASK_CREATED", msg('Created "{title}" and assigned it to {name}', { title: task.title, name: assignee.name }), ctx.actor, {
      projectId: String(project._id),
      taskId: String(task._id),
    });
    await notifyAssignment(ctx, task.toObject(), project.name, assignee);
    refresh();
    redirect(managerTaskUrl(task._id));
  });
}

export async function updateTask(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireManagerWrite();
    const { taskId } = parseForm(z.object({ taskId: zId }), formData);
    const data = parseForm(taskSchema, formData);
    const existing = await findTaskOrThrow(ctx, taskId);
    const { project, assignee, deadline, tags, checklist } = await toTaskFields(ctx, data);

    // Keep the "done" state of checklist items whose text is unchanged.
    const doneByText = new Map(existing.checklist.map((item) => [item.text, item.done]));
    const deadlineChanged = (existing.deadline?.getTime() ?? null) !== (deadline?.getTime() ?? null);

    await claimUploads(ctx, data.fileIds, taskId);
    await Task.updateOne(
      { _id: taskId, ...scope(ctx) },
      {
        $set: {
          title: data.title,
          description: data.description,
          projectId: project._id,
          assigneeId: assignee._id,
          deadline,
          priority: data.priority,
          tags,
          checklist: checklist.map((text) => ({ text, done: doneByText.get(text) ?? false })),
          ...(deadlineChanged ? { dueSoonNotifiedFor: null, overdueNotifiedFor: null } : {}),
        },
        $addToSet: { attachmentIds: { $each: [...new Set(data.fileIds)] } },
      },
    );
    await Project.updateOne({ _id: project._id, ...scope(ctx) }, { $addToSet: { memberIds: assignee._id } });

    const reassigned = String(existing.assigneeId) !== String(assignee._id);
    const refs = { projectId: String(project._id), taskId };
    if (reassigned) {
      await logWorkspace(ctx.workspace.id, "TASK_REASSIGNED", msg('Reassigned "{title}" to {name}', { title: data.title, name: assignee.name }), ctx.actor, refs);
      await notifyAssignment(ctx, { ...existing, title: data.title, deadline }, project.name, assignee);
      await notify({
        userId: String(existing.assigneeId),
        workspaceId: ctx.workspace.id,
        type: "TASK_UPDATED",
        title: msg('"{title}" was reassigned', { title: data.title }),
        body: msg("This task is no longer assigned to you."),
      });
    } else {
      await logWorkspace(ctx.workspace.id, "TASK_UPDATED", msg('Updated "{title}"', { title: data.title }), ctx.actor, refs);
      if (deadlineChanged) {
        await notify({
          userId: String(assignee._id),
          workspaceId: ctx.workspace.id,
          type: "TASK_UPDATED",
          title: msg("Deadline changed: {title}", { title: data.title }),
          body: formatDeadline(deadline, ctx.workspace.timezone),
          href: employeeTaskUrl(taskId),
        });
      }
    }
    refresh();
    return { ok: true, message: "Task saved." };
  });
}

export async function removeAttachment(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireManagerWrite();
    const data = parseForm(z.object({ taskId: zId, fileId: zId }), formData);
    const result = await Task.updateOne({ _id: data.taskId, ...scope(ctx) }, { $pull: { attachmentIds: data.fileId } });
    if (result.matchedCount === 0) throw new ActionError("Task not found.");
    // Detach only; the cleanup job removes the stored bytes.
    await FileAsset.updateOne({ _id: data.fileId, ...scope(ctx), taskId: data.taskId }, { $set: { taskId: null, attachedAt: null } });
    refresh();
    return { ok: true, message: "Attachment removed." };
  });
}

/** A finished or cancelled task has nothing left to unblock: close its open help requests. */
async function closeHelpRequests(ctx: WorkspaceContext, taskId: ITask["_id"]) {
  await HelpRequest.updateMany({ ...scope(ctx), taskId, status: "OPEN" }, { $set: { status: "RESOLVED", resolvedAt: new Date(), resolvedBy: ctx.user.id } });
  await Task.updateOne({ _id: taskId, ...scope(ctx) }, { $set: { helpRequested: false } });
}

/* ─── Manual status change (manager) ─────────────────────────────────── */

export async function setTaskStatus(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireManagerWrite();
    const data = parseForm(z.object({ taskId: zId, status: z.enum(TASK_STATUSES) }), formData);
    const task = await findTaskOrThrow(ctx, data.taskId);
    if (task.status === data.status) return { ok: true };
    if (!canManagerSetStatus(task.status, data.status)) {
      throw new ActionError(
        data.status === "SUBMITTED_FOR_REVIEW" || data.status === "CHANGES_REQUESTED"
          ? "Review outcomes are set from the review panel on the task."
          : "That status change is not allowed.",
      );
    }

    const now = new Date();
    const result = await Task.updateOne(
      { _id: task._id, ...scope(ctx), status: task.status },
      {
        $set: {
          status: data.status,
          ...(data.status === "IN_PROGRESS" && !task.startedAt ? { startedAt: now } : {}),
          completedAt: data.status === "COMPLETED" ? now : null,
        },
      },
    );
    if (result.modifiedCount === 0) throw new ActionError("This task was just updated by someone else. Refresh and try again.");
    if (data.status === "COMPLETED" || data.status === "CANCELLED") await closeHelpRequests(ctx, task._id);

    const label = TASK_STATUS_LABELS[data.status];
    await logWorkspace(ctx.workspace.id, "TASK_STATUS_CHANGED", msg('Moved "{title}" to {t_status}', { title: task.title, t_status: label }), ctx.actor, { projectId: String(task.projectId), taskId: String(task._id) });
    await notify({
      userId: String(task.assigneeId),
      workspaceId: ctx.workspace.id,
      type: "TASK_UPDATED",
      title: msg('"{title}" is now: {t_status}', { title: task.title, t_status: label }),
      body: msg("Updated by {name}", { name: ctx.user.name }),
      href: employeeTaskUrl(task._id),
    });
    refresh();
    return { ok: true, message: msg("Moved to {t_status}.", { t_status: label }) };
  });
}

/* ─── Employee workflow ──────────────────────────────────────────────── */

export async function startTask(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireEmployeeWrite();
    const { taskId } = parseForm(z.object({ taskId: zId }), formData);
    const task = await findTaskOrThrow(ctx, taskId);
    if (!canEmployee("start", task.status)) throw new ActionError("This task can't be started from its current status.");

    const result = await Task.updateOne(
      { _id: task._id, ...taskScope(ctx), status: task.status },
      { $set: { status: "IN_PROGRESS", ...(task.startedAt ? {} : { startedAt: new Date() }) } },
    );
    if (result.modifiedCount === 0) throw new ActionError("This task was just updated. Refresh and try again.");

    await logWorkspace(ctx.workspace.id, "TASK_STARTED", msg('{name} started "{title}"', { name: ctx.user.name, title: task.title }), ctx.actor, { projectId: String(task.projectId), taskId });
    refresh();
    return { ok: true, message: "Task started." };
  });
}

const helpSchema = z.object({
  taskId: zId,
  reason: z.enum(HELP_REASONS, "Select a reason"),
  message: z.string().trim().min(5, "Describe what you need").max(3000),
});

export async function requestHelp(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireEmployeeWrite();
    const data = parseForm(helpSchema, formData);
    const task = await findTaskOrThrow(ctx, data.taskId);
    if (!canEmployee("requestHelp", task.status)) throw new ActionError("Help can't be requested on a task in this status.");

    await HelpRequest.create({ ...scope(ctx), taskId: task._id, requesterId: ctx.user.id, reason: data.reason, message: data.message });
    // Being blocked by another task pauses the work; other reasons only flag it.
    const blocks = data.reason === "BLOCKED_BY_TASK" && task.status !== "BLOCKED";
    await Task.updateOne({ _id: task._id, ...taskScope(ctx) }, { $set: { helpRequested: true, ...(blocks ? { status: "BLOCKED" } : {}) } });

    const refs = { projectId: String(task.projectId), taskId: data.taskId };
    await logWorkspace(ctx.workspace.id, "HELP_REQUESTED", msg('{name} asked for help on "{title}" ({t_reason})', { name: ctx.user.name, title: task.title, t_reason: HELP_REASON_LABELS[data.reason] }), ctx.actor, refs);
    await notify({
      userId: ctx.workspace.managerId,
      workspaceId: ctx.workspace.id,
      type: "HELP_REQUESTED",
      title: msg("{name} needs help: {title}", { name: ctx.user.name, title: task.title }),
      body: msg("{t_reason} — {message}", { t_reason: HELP_REASON_LABELS[data.reason], message: data.message.slice(0, 300) }),
      href: managerTaskUrl(task._id),
    });
    refresh();
    return { ok: true, message: "Your manager has been notified." };
  });
}

const helpReplySchema = z.object({ helpId: zId, body: z.string().trim().min(1, "Write a reply").max(3000) });

export async function replyToHelp(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireMemberWrite();
    const data = parseForm(helpReplySchema, formData);
    const help = await HelpRequest.findOne({ _id: data.helpId, ...scope(ctx) }).lean();
    if (!help) throw new ActionError("Help request not found.");
    const task = await findTaskOrThrow(ctx, String(help.taskId)); // also enforces employee access

    await HelpRequest.updateOne({ _id: help._id, ...scope(ctx) }, { $push: { replies: { authorId: ctx.user.id, body: data.body, createdAt: new Date() } } });

    const toManager = ctx.user.role === "EMPLOYEE";
    await notify({
      userId: toManager ? ctx.workspace.managerId : String(help.requesterId),
      workspaceId: ctx.workspace.id,
      type: "HELP_REPLY",
      title: msg('{name} replied on "{title}"', { name: ctx.user.name, title: task.title }),
      body: data.body,
      href: toManager ? managerTaskUrl(task._id) : employeeTaskUrl(task._id),
    });
    refresh();
    return { ok: true, message: "Reply sent." };
  });
}

export async function resolveHelp(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireMemberWrite();
    const { helpId } = parseForm(z.object({ helpId: zId }), formData);
    const help = await HelpRequest.findOne({ _id: helpId, ...scope(ctx), status: "OPEN" }).lean();
    if (!help) throw new ActionError("Help request not found or already resolved.");
    const task = await findTaskOrThrow(ctx, String(help.taskId));

    await HelpRequest.updateOne({ _id: help._id, ...scope(ctx) }, { $set: { status: "RESOLVED", resolvedAt: new Date(), resolvedBy: ctx.user.id } });
    const stillOpen = await HelpRequest.exists({ ...scope(ctx), taskId: task._id, status: "OPEN" });
    if (!stillOpen) await Task.updateOne({ _id: task._id, ...scope(ctx) }, { $set: { helpRequested: false } });

    await logWorkspace(ctx.workspace.id, "HELP_RESOLVED", msg('{name} resolved a help request on "{title}"', { name: ctx.user.name, title: task.title }), ctx.actor, {
      projectId: String(task.projectId),
      taskId: String(task._id),
    });
    if (ctx.user.role === "MANAGER") {
      await notify({
        userId: String(help.requesterId),
        workspaceId: ctx.workspace.id,
        type: "HELP_RESOLVED",
        title: msg("Help request resolved: {title}", { title: task.title }),
        href: employeeTaskUrl(task._id),
      });
    }
    refresh();
    return { ok: true, message: "Marked as resolved." };
  });
}

const submitSchema = z.object({ taskId: zId, note: zOptionalText(5000), fileIds: zIdList });

export async function submitTask(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireEmployeeWrite();
    const data = parseForm(submitSchema, formData);
    const task = await findTaskOrThrow(ctx, data.taskId);
    if (!canEmployee("submit", task.status)) throw new ActionError("This task can't be submitted from its current status.");
    if (!data.note && data.fileIds.length === 0) throw new ActionError("Add a note or at least one file to your submission.");

    // Claim the status first so a double-click cannot create two submissions.
    const now = new Date();
    const claimed = await Task.updateOne(
      { _id: task._id, ...taskScope(ctx), status: task.status },
      { $set: { status: "SUBMITTED_FOR_REVIEW", submittedAt: now, ...(task.startedAt ? {} : { startedAt: now }) } },
    );
    if (claimed.modifiedCount === 0) throw new ActionError("This task was just updated. Refresh and try again.");

    try {
      await claimUploads(ctx, data.fileIds, data.taskId);
      // Submissions are append-only: each one gets the next version number.
      const last = await Submission.findOne({ ...scope(ctx), taskId: task._id }).sort({ version: -1 }).select("version").lean();
      await Submission.create({
        ...scope(ctx),
        taskId: task._id,
        submittedBy: ctx.user.id,
        version: (last?.version ?? 0) + 1,
        note: data.note,
        fileIds: [...new Set(data.fileIds)],
      });
    } catch (err) {
      await Task.updateOne({ _id: task._id, ...scope(ctx) }, { $set: { status: task.status, submittedAt: task.submittedAt ?? null } });
      throw err;
    }

    await logWorkspace(ctx.workspace.id, "TASK_SUBMITTED", msg('{name} submitted "{title}" for review', { name: ctx.user.name, title: task.title }), ctx.actor, {
      projectId: String(task.projectId),
      taskId: data.taskId,
    });
    await notify({
      userId: ctx.workspace.managerId,
      workspaceId: ctx.workspace.id,
      type: "TASK_SUBMITTED",
      title: msg("Ready for review: {title}", { title: task.title }),
      body: msg("Submitted by {name}", { name: ctx.user.name }),
      href: managerTaskUrl(task._id),
    });
    refresh();
    return { ok: true, message: "Submitted for review." };
  });
}

/* ─── Review (manager) ───────────────────────────────────────────────── */

const reviewSchema = z.object({ taskId: zId, decision: z.enum(REVIEW_DECISIONS), feedback: zOptionalText(5000) });

export async function reviewSubmission(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireManagerWrite();
    const data = parseForm(reviewSchema, formData);
    const task = await findTaskOrThrow(ctx, data.taskId);
    const action = data.decision === "APPROVED" ? "approve" : "requestChanges";
    if (!canManager(action, task.status)) throw new ActionError("This task is not waiting for review.");
    if (data.decision === "CHANGES_REQUESTED" && !data.feedback) {
      return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { feedback: ["Explain what needs to change"] } };
    }

    const now = new Date();
    const submission = await Submission.findOneAndUpdate(
      { ...scope(ctx), taskId: task._id, review: null },
      { $set: { review: { decision: data.decision, feedback: data.feedback, reviewerId: ctx.user.id, reviewedAt: now } } },
      { sort: { version: -1 } },
    ).lean();
    if (!submission) throw new ActionError("There is no submission waiting for review.");

    const status = managerTarget(action);
    await Task.updateOne({ _id: task._id, ...scope(ctx) }, { $set: { status, completedAt: status === "COMPLETED" ? now : null } });
    if (status === "COMPLETED") await closeHelpRequests(ctx, task._id);

    const approved = data.decision === "APPROVED";
    await logWorkspace(
      ctx.workspace.id,
      approved ? "TASK_APPROVED" : "CHANGES_REQUESTED",
      msg(approved ? 'Approved "{title}"' : 'Requested changes on "{title}"', { title: task.title }),
      ctx.actor,
      { projectId: String(task.projectId), taskId: data.taskId },
    );
    await notify({
      userId: String(task.assigneeId),
      workspaceId: ctx.workspace.id,
      type: approved ? "TASK_APPROVED" : "CHANGES_REQUESTED",
      title: msg(approved ? "Approved: {title}" : "Changes requested: {title}", { title: task.title }),
      body: data.feedback,
      href: employeeTaskUrl(task._id),
    });
    refresh();
    return { ok: true, message: approved ? "Approved — task completed." : "Changes requested." };
  });
}

/* ─── Comments & checklist (manager and assignee) ────────────────────── */

const commentSchema = z.object({ taskId: zId, body: z.string().trim().min(1, "Write a comment").max(5000) });

export async function addComment(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireMemberWrite();
    const data = parseForm(commentSchema, formData);
    const task = await findTaskOrThrow(ctx, data.taskId);
    await Comment.create({ ...scope(ctx), taskId: task._id, authorId: ctx.user.id, body: data.body });

    const toManager = ctx.user.role === "EMPLOYEE";
    await notify({
      userId: toManager ? ctx.workspace.managerId : String(task.assigneeId),
      workspaceId: ctx.workspace.id,
      type: "COMMENT",
      title: msg('{name} commented on "{title}"', { name: ctx.user.name, title: task.title }),
      body: data.body,
      href: toManager ? managerTaskUrl(task._id) : employeeTaskUrl(task._id),
    });
    refresh();
    return { ok: true };
  });
}

export async function toggleChecklistItem(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireMemberWrite();
    const data = parseForm(z.object({ taskId: zId, itemId: zId, done: z.enum(["true", "false"]) }), formData);
    const result = await Task.updateOne(
      { _id: data.taskId, ...taskScope(ctx), "checklist._id": data.itemId },
      { $set: { "checklist.$.done": data.done === "true" } },
    );
    if (result.matchedCount === 0) throw new ActionError("Checklist item not found.");
    refresh();
    return { ok: true };
  });
}
