import type { WorkspaceStatus } from "@/lib/constants";

/**
 * THE single source of truth for subscription/account state.
 *
 * Everything that needs to know whether a workspace is active, past due, or
 * suspended goes through `computeWorkspaceStatus`, and everything that needs to
 * know what a status permits goes through `accessFor`. Do not re-derive either
 * anywhere else.
 *
 * This module is pure (no I/O) so it can be unit-tested and shared with the UI.
 */

const DAY_MS = 86_400_000;

export interface StatusInput {
  subscription: { renewalDate: Date; cancelledAt?: Date | null } | null;
  manualSuspendedAt?: Date | null;
  gracePeriodDays: number;
  now?: Date;
}

export function computeWorkspaceStatus({ subscription, manualSuspendedAt, gracePeriodDays, now = new Date() }: StatusInput): WorkspaceStatus {
  if (!subscription) return "PENDING_PAYMENT";
  if (subscription.cancelledAt) return "CANCELLED";
  if (manualSuspendedAt) return "SUSPENDED";

  const renewal = subscription.renewalDate.getTime();
  if (now.getTime() < renewal) return "ACTIVE";
  if (now.getTime() < suspensionDate(subscription.renewalDate, gracePeriodDays).getTime()) return "PAST_DUE";
  return "SUSPENDED";
}

/** The instant a past-due subscription becomes suspended. */
export function suspensionDate(renewalDate: Date, gracePeriodDays: number): Date {
  return new Date(renewalDate.getTime() + Math.max(0, gracePeriodDays) * DAY_MS);
}

export interface WorkspaceAccess {
  /** May the manager and employees open the workspace at all? */
  workspace: boolean;
  /** May they create or change anything (projects, tasks, invitations, submissions)? */
  write: boolean;
}

const ACCESS: Record<WorkspaceStatus, WorkspaceAccess> = {
  PENDING_PAYMENT: { workspace: false, write: false },
  ACTIVE: { workspace: true, write: true },
  PAST_DUE: { workspace: true, write: true },
  SUSPENDED: { workspace: false, write: false },
  CANCELLED: { workspace: false, write: false },
};

export function accessFor(status: WorkspaceStatus): WorkspaceAccess {
  return ACCESS[status];
}

/** Whole days from `now` until `date` (negative when in the past). */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
}

/** A subscription that is billable but whose current period has not been paid for. */
export function isOutstanding(status: WorkspaceStatus): boolean {
  return status === "PAST_DUE" || status === "SUSPENDED";
}
