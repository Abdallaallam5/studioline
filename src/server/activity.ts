import "server-only";
import { renderEnglish, type StoredMessage } from "@/lib/i18n/config";
import { ActivityLog, type ActivityScope } from "@/models";

export interface Actor {
  id: string | null;
  name: string;
}

export const SYSTEM_ACTOR: Actor = { id: null, name: "System" };

/** Platform-level events the owner sees. Operational only — never task content. */
export const PLATFORM_ACTIONS = {
  MANAGER_REGISTERED: "Registration received",
  MANAGER_APPROVED: "Registration approved",
  MANAGER_REJECTED: "Registration rejected",
  WORKSPACE_CREATED: "Workspace created",
  SUBSCRIPTION_ACTIVATED: "Subscription activated",
  SUBSCRIPTION_UPDATED: "Subscription updated",
  SUBSCRIPTION_CANCELLED: "Subscription cancelled",
  PAYMENT_RECORDED: "Payment recorded",
  PAYMENT_VOIDED: "Payment voided",
  ACCOUNT_STATUS_CHANGED: "Account status changed",
  ACCOUNT_SUSPENDED: "Account suspended",
  ACCOUNT_REINSTATED: "Account reinstated",
  ACCOUNT_DISABLED: "Account disabled",
  ACCOUNT_ENABLED: "Account enabled",
  EMPLOYEE_COUNT_CHANGED: "Employee count changed",
  SETTINGS_UPDATED: "Platform settings updated",
} as const;
export type PlatformAction = keyof typeof PLATFORM_ACTIONS;

interface LogInput {
  scope: ActivityScope;
  action: string;
  /** A translatable message (preferred) or plain text. */
  summary: string | StoredMessage;
  actor: Actor;
  workspaceId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  meta?: Record<string, unknown>;
}

/** Append to the audit log. Logging failures never break the calling action. */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    const translatable = typeof input.summary === "string" ? null : input.summary;
    await ActivityLog.create({
      scope: input.scope,
      action: input.action,
      // English text is kept as a fallback; the template lets readers see it in their own language.
      summary: (translatable ? renderEnglish(translatable) : (input.summary as string)).slice(0, 500),
      summaryT: translatable,
      actorId: input.actor.id,
      actorName: input.actor.name,
      workspaceId: input.workspaceId ?? null,
      projectId: input.projectId ?? null,
      taskId: input.taskId ?? null,
      meta: input.meta ?? null,
    });
  } catch (err) {
    console.error("[activity] failed to write log entry:", err);
  }
}

export function logPlatform(action: PlatformAction, summary: string | StoredMessage, actor: Actor, workspaceId?: string | null, meta?: Record<string, unknown>) {
  return logActivity({ scope: "PLATFORM", action, summary, actor, workspaceId, meta });
}

export function logWorkspace(
  workspaceId: string,
  action: string,
  summary: string | StoredMessage,
  actor: Actor,
  refs: { projectId?: string | null; taskId?: string | null } = {},
) {
  return logActivity({ scope: "WORKSPACE", action, summary, actor, workspaceId, ...refs });
}
