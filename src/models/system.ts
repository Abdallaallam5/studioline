import { Schema } from "mongoose";
import type { StoredMessage } from "@/lib/i18n/config";
import { getModel, type Id, type Timestamps } from "./helpers";

/* ─── In-app notification ────────────────────────────────────────────── */

export interface INotification extends Timestamps {
  _id: Id;
  userId: Id;
  workspaceId?: Id | null;
  type: string;
  /** English text, used as a fallback when no template is stored. */
  title: string;
  body?: string | null;
  /** Translatable templates, rendered in the reader's language. */
  titleT?: StoredMessage | null;
  bodyT?: StoredMessage | null;
  href?: string | null;
  readAt?: Date | null;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", default: null },
    type: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: null, maxlength: 500 },
    titleT: { type: Schema.Types.Mixed, default: null },
    bodyT: { type: Schema.Types.Mixed, default: null },
    href: { type: String, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export const Notification = getModel<INotification>("Notification", notificationSchema);

/* ─── Activity / audit log ───────────────────────────────────────────── */

/**
 * PLATFORM entries are operational events the owner may see.
 * WORKSPACE entries belong to a tenant and are only shown inside it.
 */
export type ActivityScope = "PLATFORM" | "WORKSPACE";

export interface IActivityLog extends Timestamps {
  _id: Id;
  scope: ActivityScope;
  workspaceId?: Id | null;
  actorId?: Id | null;
  actorName: string;
  action: string;
  summary: string;
  summaryT?: StoredMessage | null;
  projectId?: Id | null;
  taskId?: Id | null;
  meta?: Record<string, unknown> | null;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    scope: { type: String, enum: ["PLATFORM", "WORKSPACE"], required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", default: null },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, required: true },
    action: { type: String, required: true },
    summary: { type: String, required: true, maxlength: 500 },
    summaryT: { type: Schema.Types.Mixed, default: null },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);
activityLogSchema.index({ scope: 1, createdAt: -1 });
activityLogSchema.index({ workspaceId: 1, scope: 1, createdAt: -1 });
activityLogSchema.index({ workspaceId: 1, taskId: 1, createdAt: -1 });

export const ActivityLog = getModel<IActivityLog>("ActivityLog", activityLogSchema);
