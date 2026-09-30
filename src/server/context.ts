import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { HOME_BY_ROLE, type Role, type WorkspaceStatus } from "@/lib/constants";
import { accessFor, type WorkspaceAccess } from "@/lib/subscription/status";
import type { Actor } from "./activity";
import { syncWorkspaceStatus } from "./subscription";

/**
 * Authorization guards. Every protected page and every server action starts by
 * calling one of these — layouts alone are not a security boundary. They
 * resolve the session, enforce the role, refresh the subscription status, and
 * hand back the tenant id that all subsequent queries must be scoped to.
 */

export interface WorkspaceInfo {
  id: string;
  name: string;
  timezone: string;
  status: WorkspaceStatus;
  managerId: string;
}

export interface WorkspaceContext {
  user: SessionUser;
  workspace: WorkspaceInfo;
  access: WorkspaceAccess;
  actor: Actor;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

async function requireRole(role: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) redirect(HOME_BY_ROLE[user.role]);
  return user;
}

export async function requireOwner(): Promise<{ user: SessionUser; actor: Actor }> {
  const user = await requireRole("OWNER");
  return { user, actor: { id: user.id, name: user.name } };
}

const loadWorkspace = cache(async (workspaceId: string): Promise<WorkspaceInfo | null> => {
  const workspace = await syncWorkspaceStatus(workspaceId);
  if (!workspace) return null;
  return {
    id: String(workspace._id),
    name: workspace.name,
    timezone: workspace.timezone,
    status: workspace.accountStatus,
    managerId: String(workspace.managerId),
  };
});

async function workspaceContext(role: "MANAGER" | "EMPLOYEE"): Promise<WorkspaceContext> {
  const user = await requireRole(role);
  const workspace = user.workspaceId ? await loadWorkspace(user.workspaceId) : null;
  if (!workspace) redirect("/login");
  return { user, workspace, access: accessFor(workspace.status), actor: { id: user.id, name: user.name } };
}

/**
 * Project Manager guard. Without `allowRestricted`, managers whose workspace is
 * not usable (pending payment, suspended, cancelled) are sent to the limited
 * account page.
 */
export async function requireManager(opts: { allowRestricted?: boolean } = {}): Promise<WorkspaceContext> {
  const ctx = await workspaceContext("MANAGER");
  if (!ctx.access.workspace && !opts.allowRestricted) redirect("/workspace/account");
  return ctx;
}

/** Employee guard. Employees of an unusable workspace only see a "paused" notice. */
export async function requireEmployee(opts: { allowRestricted?: boolean } = {}): Promise<WorkspaceContext> {
  const ctx = await workspaceContext("EMPLOYEE");
  if (!ctx.access.workspace && !opts.allowRestricted) redirect("/my/paused");
  return ctx;
}

/** Non-redirecting variant for route handlers, which answer with status codes instead. */
export async function getMemberContext(): Promise<WorkspaceContext | null> {
  const user = await getCurrentUser();
  if (!user || user.role === "OWNER" || !user.workspaceId) return null;
  const workspace = await loadWorkspace(user.workspaceId);
  if (!workspace) return null;
  return { user, workspace, access: accessFor(workspace.status), actor: { id: user.id, name: user.name } };
}

/** Any member of a workspace (manager or employee); used by shared actions. */
export async function requireMember(): Promise<WorkspaceContext> {
  const user = await requireUser();
  if (user.role === "OWNER") redirect(HOME_BY_ROLE.OWNER);
  return user.role === "MANAGER" ? requireManager() : requireEmployee();
}
