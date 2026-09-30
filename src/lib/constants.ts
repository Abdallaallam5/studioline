/**
 * Domain enums shared by the database layer, server logic, and UI.
 * Keep this file free of server-only imports so client components can use it.
 */

export const ROLES = ["OWNER", "MANAGER", "EMPLOYEE"] as const;
export type Role = (typeof ROLES)[number];

/** Lifecycle of a registration request, before a workspace exists. */
export const REQUEST_STATUSES = ["PENDING_APPROVAL", "PENDING_VERIFICATION", "REJECTED", "COMPLETED"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Lifecycle of a workspace once the Project Manager has verified their email. */
export const WORKSPACE_STATUSES = ["PENDING_PAYMENT", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

export type AccountStatus = "PENDING_APPROVAL" | "PENDING_VERIFICATION" | WorkspaceStatus;

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus | "REJECTED" | "COMPLETED", string> = {
  PENDING_APPROVAL: "Pending approval",
  PENDING_VERIFICATION: "Pending verification",
  PENDING_PAYMENT: "Pending payment",
  ACTIVE: "Active",
  PAST_DUE: "Past due",
  SUSPENDED: "Suspended",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
};

export const PROJECT_STATUSES = ["PLANNED", "ACTIVE", "COMPLETED", "ARCHIVED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export const PROJECT_COLORS = ["#1f5f4f", "#2f5fb3", "#7a4fb3", "#b3563a", "#b38a1f", "#3f7f8f", "#a23f6b", "#55554f"] as const;

export const TASK_STATUSES = [
  "NEW",
  "IN_PROGRESS",
  "BLOCKED",
  "SUBMITTED_FOR_REVIEW",
  "CHANGES_REQUESTED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  NEW: "New",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  SUBMITTED_FOR_REVIEW: "In review",
  CHANGES_REQUESTED: "Changes requested",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
/** Statuses where work is still expected; used for "open task" counts and overdue checks. */
export const OPEN_TASK_STATUSES: TaskStatus[] = ["NEW", "IN_PROGRESS", "BLOCKED", "CHANGES_REQUESTED"];
/** Open statuses plus work that is waiting on the manager. */
export const ACTIVE_TASK_STATUSES: TaskStatus[] = [...OPEN_TASK_STATUSES, "SUBMITTED_FOR_REVIEW"];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const HELP_REASONS = ["CLARIFICATION", "MISSING_FILE", "BLOCKED_BY_TASK", "TECHNICAL", "OTHER"] as const;
export type HelpReason = (typeof HELP_REASONS)[number];
export const HELP_REASON_LABELS: Record<HelpReason, string> = {
  CLARIFICATION: "Need clarification",
  MISSING_FILE: "Missing file",
  BLOCKED_BY_TASK: "Blocked by another task",
  TECHNICAL: "Technical problem",
  OTHER: "Other",
};

export const PAYMENT_METHODS = ["BANK_TRANSFER", "CASH", "CARD", "MOBILE_WALLET", "CHEQUE", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CARD: "Card",
  MOBILE_WALLET: "Mobile wallet",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

export const TEAM_SIZES = ["1-5", "6-15", "16-50", "51+"] as const;

export const REVIEW_DECISIONS = ["APPROVED", "CHANGES_REQUESTED"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const SESSION_COOKIE = "sl_session";

export const HOME_BY_ROLE: Record<Role, string> = {
  OWNER: "/owner",
  MANAGER: "/workspace",
  EMPLOYEE: "/my",
};
