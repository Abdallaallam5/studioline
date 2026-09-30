import type { TaskStatus } from "@/lib/constants";

/**
 * Task state machine. All status changes are validated here, server-side.
 *
 *   NEW ─start→ IN_PROGRESS ─submit→ SUBMITTED_FOR_REVIEW ─approve→ COMPLETED
 *                    ▲                        │
 *                    └──── start ── CHANGES_REQUESTED ◄─ request changes
 *
 * Employees never need approval to start. Managers additionally have a manual
 * override for housekeeping (cancel, reopen, mark complete).
 */

export type EmployeeAction = "start" | "submit" | "requestHelp";
export type ManagerAction = "approve" | "requestChanges";

const EMPLOYEE_TRANSITIONS: Record<EmployeeAction, { from: TaskStatus[]; to: TaskStatus | null }> = {
  start: { from: ["NEW", "CHANGES_REQUESTED", "BLOCKED"], to: "IN_PROGRESS" },
  submit: { from: ["NEW", "IN_PROGRESS", "CHANGES_REQUESTED", "BLOCKED"], to: "SUBMITTED_FOR_REVIEW" },
  // Asking for help keeps the status; the task is flagged instead.
  requestHelp: { from: ["NEW", "IN_PROGRESS", "BLOCKED", "CHANGES_REQUESTED"], to: null },
};

const MANAGER_TRANSITIONS: Record<ManagerAction, { from: TaskStatus[]; to: TaskStatus }> = {
  approve: { from: ["SUBMITTED_FOR_REVIEW"], to: "COMPLETED" },
  requestChanges: { from: ["SUBMITTED_FOR_REVIEW"], to: "CHANGES_REQUESTED" },
};

export function canEmployee(action: EmployeeAction, status: TaskStatus): boolean {
  return EMPLOYEE_TRANSITIONS[action].from.includes(status);
}

export function employeeTarget(action: EmployeeAction): TaskStatus | null {
  return EMPLOYEE_TRANSITIONS[action].to;
}

export function canManager(action: ManagerAction, status: TaskStatus): boolean {
  return MANAGER_TRANSITIONS[action].from.includes(status);
}

export function managerTarget(action: ManagerAction): TaskStatus {
  return MANAGER_TRANSITIONS[action].to;
}

/**
 * Statuses a manager may set directly (board drag, status menu). Review outcomes
 * are excluded on purpose: they must go through the review flow so the
 * submission history records who decided what.
 */
export const MANAGER_MANUAL_STATUSES: TaskStatus[] = ["NEW", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"];

export function canManagerSetStatus(from: TaskStatus, to: TaskStatus): boolean {
  return from !== to && MANAGER_MANUAL_STATUSES.includes(to);
}

export function isOverdue(task: { deadline?: Date | null; status: TaskStatus }, now: Date = new Date()): boolean {
  if (!task.deadline) return false;
  if (!["NEW", "IN_PROGRESS", "BLOCKED", "CHANGES_REQUESTED"].includes(task.status)) return false;
  return task.deadline.getTime() < now.getTime();
}
