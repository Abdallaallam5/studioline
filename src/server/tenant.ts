import "server-only";
import { Types } from "mongoose";
import { FileAsset, Task, User, type ITask } from "@/models";
import { ActionError } from "./action-utils";
import type { WorkspaceContext } from "./context";

/**
 * Tenant scoping helpers. Every query on workspace data starts from one of
 * these filters so a document id from another workspace can never match.
 */

export function scope(ctx: WorkspaceContext): { workspaceId: string } {
  return { workspaceId: ctx.workspace.id };
}

/** Tasks the viewer may see: all workspace tasks for managers, own tasks for employees. */
export function taskScope(ctx: WorkspaceContext): { workspaceId: string; assigneeId?: string } {
  return ctx.user.role === "EMPLOYEE" ? { workspaceId: ctx.workspace.id, assigneeId: ctx.user.id } : { workspaceId: ctx.workspace.id };
}

/** Aggregation pipelines do not auto-cast strings, so they need a real ObjectId. */
export function oid(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

export async function findTaskOrThrow(ctx: WorkspaceContext, taskId: string): Promise<ITask> {
  const task = await Task.findOne({ _id: taskId, ...taskScope(ctx) }).lean();
  if (!task) throw new ActionError("Task not found.");
  return task;
}

/** Active employees of the viewer's workspace. */
export function listEmployees(ctx: WorkspaceContext, opts: { includeDisabled?: boolean } = {}) {
  return User.find({ ...scope(ctx), role: "EMPLOYEE", ...(opts.includeDisabled ? {} : { disabledAt: null }) })
    .sort({ name: 1 })
    .lean();
}

/**
 * Attach previously uploaded files to a task. Only files that belong to this
 * workspace, were uploaded by this user, and are not attached yet qualify, so
 * ids guessed or copied from elsewhere are rejected.
 */
export async function claimUploads(ctx: WorkspaceContext, fileIds: string[], taskId: string): Promise<void> {
  if (fileIds.length === 0) return;
  const unique = [...new Set(fileIds)];
  const result = await FileAsset.updateMany(
    { _id: { $in: unique }, ...scope(ctx), uploadedBy: ctx.user.id, attachedAt: null },
    { $set: { taskId, attachedAt: new Date() } },
  );
  if (result.modifiedCount !== unique.length) throw new ActionError("One or more attachments could not be found. Please upload them again.");
}
