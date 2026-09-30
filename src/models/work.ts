import { Schema } from "mongoose";
import {
  HELP_REASONS,
  PROJECT_STATUSES,
  REVIEW_DECISIONS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type HelpReason,
  type ProjectStatus,
  type ReviewDecision,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/constants";
import { getModel, type Id, type Timestamps } from "./helpers";

/*
 * Every document in this file is tenant data and carries `workspaceId`.
 * Queries must always include it — use the helpers in src/server/data.
 */

/* ─── Project ────────────────────────────────────────────────────────── */

export interface IProject extends Timestamps {
  _id: Id;
  workspaceId: Id;
  name: string;
  description?: string | null;
  clientName?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  status: ProjectStatus;
  memberIds: Id[];
  color: string;
  createdBy: Id;
}

const projectSchema = new Schema<IProject>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: null, maxlength: 5000 },
    clientName: { type: String, default: null, maxlength: 160 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    status: { type: String, enum: PROJECT_STATUSES, default: "PLANNED" },
    memberIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    color: { type: String, default: "#1f5f4f" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

export const Project = getModel<IProject>("Project", projectSchema);

/* ─── Task ───────────────────────────────────────────────────────────── */

export interface IChecklistItem {
  _id: Id;
  text: string;
  done: boolean;
}

export interface ITask extends Timestamps {
  _id: Id;
  workspaceId: Id;
  projectId: Id;
  title: string;
  description?: string | null;
  assigneeId: Id;
  deadline?: Date | null;
  priority: TaskPriority;
  status: TaskStatus;
  checklist: IChecklistItem[];
  tags: string[];
  attachmentIds: Id[];
  /** True while at least one help request on the task is open. */
  helpRequested: boolean;
  startedAt?: Date | null;
  submittedAt?: Date | null;
  completedAt?: Date | null;
  createdBy: Id;
  /** Deadline the "due soon" / "overdue" reminders were last sent for. */
  dueSoonNotifiedFor?: Date | null;
  overdueNotifiedFor?: Date | null;
}

const taskSchema = new Schema<ITask>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null, maxlength: 10000 },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deadline: { type: Date, default: null },
    priority: { type: String, enum: TASK_PRIORITIES, default: "MEDIUM" },
    status: { type: String, enum: TASK_STATUSES, default: "NEW" },
    checklist: [{ text: { type: String, required: true, maxlength: 300 }, done: { type: Boolean, default: false } }],
    tags: [{ type: String, maxlength: 40 }],
    attachmentIds: [{ type: Schema.Types.ObjectId, ref: "FileAsset" }],
    helpRequested: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dueSoonNotifiedFor: { type: Date, default: null },
    overdueNotifiedFor: { type: Date, default: null },
  },
  { timestamps: true },
);
taskSchema.index({ workspaceId: 1, status: 1, deadline: 1 });
taskSchema.index({ workspaceId: 1, assigneeId: 1, status: 1 });
taskSchema.index({ workspaceId: 1, projectId: 1 });

export const Task = getModel<ITask>("Task", taskSchema);

/* ─── Comment ────────────────────────────────────────────────────────── */

export interface IComment extends Timestamps {
  _id: Id;
  workspaceId: Id;
  taskId: Id;
  authorId: Id;
  body: string;
}

const commentSchema = new Schema<IComment>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, maxlength: 5000 },
  },
  { timestamps: true },
);
commentSchema.index({ workspaceId: 1, taskId: 1, createdAt: 1 });

export const Comment = getModel<IComment>("Comment", commentSchema);

/* ─── Help request ───────────────────────────────────────────────────── */

export interface IHelpReply {
  _id: Id;
  authorId: Id;
  body: string;
  createdAt: Date;
}

export interface IHelpRequest extends Timestamps {
  _id: Id;
  workspaceId: Id;
  taskId: Id;
  requesterId: Id;
  reason: HelpReason;
  message: string;
  status: "OPEN" | "RESOLVED";
  replies: IHelpReply[];
  resolvedAt?: Date | null;
  resolvedBy?: Id | null;
}

const helpRequestSchema = new Schema<IHelpRequest>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    requesterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, enum: HELP_REASONS, required: true },
    message: { type: String, required: true, maxlength: 3000 },
    status: { type: String, enum: ["OPEN", "RESOLVED"], default: "OPEN" },
    replies: [
      {
        authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        body: { type: String, required: true, maxlength: 3000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);
helpRequestSchema.index({ workspaceId: 1, taskId: 1, createdAt: -1 });
helpRequestSchema.index({ workspaceId: 1, status: 1 });

export const HelpRequest = getModel<IHelpRequest>("HelpRequest", helpRequestSchema);

/* ─── Submission (append-only history) ───────────────────────────────── */

export interface ISubmissionReview {
  decision: ReviewDecision;
  feedback?: string | null;
  reviewerId: Id;
  reviewedAt: Date;
}

export interface ISubmission extends Timestamps {
  _id: Id;
  workspaceId: Id;
  taskId: Id;
  submittedBy: Id;
  /** 1-based, increments with every submission on the task. */
  version: number;
  note?: string | null;
  fileIds: Id[];
  review?: ISubmissionReview | null;
}

const submissionSchema = new Schema<ISubmission>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    version: { type: Number, required: true },
    note: { type: String, default: null, maxlength: 5000 },
    fileIds: [{ type: Schema.Types.ObjectId, ref: "FileAsset" }],
    review: {
      type: new Schema<ISubmissionReview>(
        {
          decision: { type: String, enum: REVIEW_DECISIONS, required: true },
          feedback: { type: String, default: null, maxlength: 5000 },
          reviewerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
          reviewedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);
submissionSchema.index({ workspaceId: 1, taskId: 1, version: 1 }, { unique: true });

export const Submission = getModel<ISubmission>("Submission", submissionSchema);

/* ─── File asset (metadata only; bytes live in object storage) ───────── */

export interface IFileAsset extends Timestamps {
  _id: Id;
  workspaceId: Id;
  uploadedBy: Id;
  provider: "mongodb" | "local" | "cloudinary";
  /** Provider-specific locator (GridFS file id, disk path key, or Cloudinary public_id). */
  key: string;
  resourceType?: string | null;
  format?: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  /** Set once the upload is attached to a task, submission, or comment. */
  taskId?: Id | null;
  attachedAt?: Date | null;
}

const fileAssetSchema = new Schema<IFileAsset>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, enum: ["mongodb", "local", "cloudinary"], required: true },
    key: { type: String, required: true },
    resourceType: { type: String, default: null },
    format: { type: String, default: null },
    originalName: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    attachedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
fileAssetSchema.index({ workspaceId: 1, taskId: 1 });
fileAssetSchema.index({ attachedAt: 1, createdAt: 1 });

export const FileAsset = getModel<IFileAsset>("FileAsset", fileAssetSchema);
