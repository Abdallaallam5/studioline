import "server-only";
import type { WorkspaceStatus } from "@/lib/constants";
import { addDays, utcMonthRange } from "@/lib/dates";
import { isOutstanding } from "@/lib/subscription/status";
import { Payment, Project, RegistrationRequest, Subscription, User, Workspace, type IPayment, type ISubscription } from "@/models";
import { getPlatformSettings, refreshStaleStatuses } from "./subscription";

/*
 * Read models for the owner area. They expose operational and billing data
 * only — never task content, comments, or files from inside a workspace.
 */

export interface ManagerRow {
  workspaceId: string;
  workspaceName: string;
  status: WorkspaceStatus;
  disabled: boolean;
  manuallySuspended: boolean;
  suspendReason: string | null;
  createdAt: Date;
  manager: { id: string; name: string; email: string; phone: string | null } | null;
  subscription: Pick<ISubscription, "amountCents" | "startDate" | "renewalDate" | "cancelledAt" | "notes"> | null;
  lastPayment: Pick<IPayment, "amountCents" | "paidAt"> | null;
  employeeCount: number;
  projectCount: number;
}

export async function listManagers(filter: { workspaceId?: string } = {}): Promise<ManagerRow[]> {
  await refreshStaleStatuses();
  const workspaces = await Workspace.find(filter.workspaceId ? { _id: filter.workspaceId } : {})
    .sort({ createdAt: -1 })
    .lean();
  const ids = workspaces.map((w) => w._id);

  const [managers, subscriptions, employeeCounts, projectCounts, lastPayments] = await Promise.all([
    User.find({ _id: { $in: workspaces.map((w) => w.managerId) } }).lean(),
    Subscription.find({ workspaceId: { $in: ids } }).lean(),
    User.aggregate<{ _id: unknown; count: number }>([
      { $match: { workspaceId: { $in: ids }, role: "EMPLOYEE", disabledAt: null } },
      { $group: { _id: "$workspaceId", count: { $sum: 1 } } },
    ]),
    Project.aggregate<{ _id: unknown; count: number }>([{ $match: { workspaceId: { $in: ids } } }, { $group: { _id: "$workspaceId", count: { $sum: 1 } } }]),
    Payment.aggregate<{ _id: unknown; amountCents: number; paidAt: Date }>([
      { $match: { workspaceId: { $in: ids }, voidedAt: null } },
      { $sort: { paidAt: -1 } },
      { $group: { _id: "$workspaceId", amountCents: { $first: "$amountCents" }, paidAt: { $first: "$paidAt" } } },
    ]),
  ]);

  const byId = <T extends { _id: unknown }>(rows: T[]) => new Map(rows.map((r) => [String(r._id), r]));
  const managerMap = byId(managers);
  const subscriptionMap = new Map(subscriptions.map((s) => [String(s.workspaceId), s]));
  const employeeMap = byId(employeeCounts);
  const projectMap = byId(projectCounts);
  const paymentMap = byId(lastPayments);

  return workspaces.map((w) => {
    const id = String(w._id);
    const manager = managerMap.get(String(w.managerId));
    const subscription = subscriptionMap.get(id) ?? null;
    const lastPayment = paymentMap.get(id) ?? null;
    return {
      workspaceId: id,
      workspaceName: w.name,
      status: w.accountStatus,
      disabled: Boolean(w.disabledAt),
      manuallySuspended: Boolean(w.manualSuspendedAt),
      suspendReason: w.manualSuspendReason ?? null,
      createdAt: w.createdAt,
      manager: manager ? { id: String(manager._id), name: manager.name, email: manager.email, phone: manager.phone ?? null } : null,
      subscription,
      lastPayment: lastPayment ? { amountCents: lastPayment.amountCents, paidAt: lastPayment.paidAt } : null,
      employeeCount: employeeMap.get(id)?.count ?? 0,
      projectCount: projectMap.get(id)?.count ?? 0,
    };
  });
}

async function sumPayments(range?: { start: Date; end: Date }): Promise<number> {
  const [row] = await Payment.aggregate<{ total: number }>([
    { $match: { voidedAt: null, ...(range ? { paidAt: { $gte: range.start, $lt: range.end } } : {}) } },
    { $group: { _id: null, total: { $sum: "$amountCents" } } },
  ]);
  return row?.total ?? 0;
}

export interface RevenueSummary {
  currentMonthCents: number;
  previousMonthCents: number;
  totalCollectedCents: number;
  /** One unpaid period per workspace that is past due or suspended for non-payment. */
  outstandingCents: number;
  outstandingCount: number;
}

/** Revenue figures, computed from stored payment records (voided payments excluded). */
export async function getRevenueSummary(rows?: ManagerRow[]): Promise<RevenueSummary> {
  const managers = rows ?? (await listManagers());
  const now = new Date();
  const [currentMonthCents, previousMonthCents, totalCollectedCents] = await Promise.all([
    sumPayments(utcMonthRange(now)),
    sumPayments(utcMonthRange(now, -1)),
    sumPayments(),
  ]);
  const outstanding = managers.filter((m) => m.subscription && isOutstanding(m.status) && m.subscription.renewalDate <= now);
  return {
    currentMonthCents,
    previousMonthCents,
    totalCollectedCents,
    outstandingCents: outstanding.reduce((sum, m) => sum + (m.subscription?.amountCents ?? 0), 0),
    outstandingCount: outstanding.length,
  };
}

export async function getOwnerDashboard() {
  const [managers, settings, pendingRequests] = await Promise.all([
    listManagers(),
    getPlatformSettings(),
    RegistrationRequest.find({ status: "PENDING_APPROVAL" }).sort({ createdAt: 1 }).lean(),
  ]);
  const revenue = await getRevenueSummary(managers);
  const now = new Date();
  const soon = addDays(now, settings.renewalSoonDays);

  return {
    settings,
    revenue,
    pendingRequests,
    totalManagers: managers.length,
    activeSubscriptions: managers.filter((m) => m.status === "ACTIVE").length,
    suspendedAccounts: managers.filter((m) => m.status === "SUSPENDED").length,
    paymentsDue: managers.filter((m) => m.subscription && isOutstanding(m.status) && m.subscription.renewalDate <= now),
    renewalsSoon: managers
      .filter((m) => m.status === "ACTIVE" && m.subscription && m.subscription.renewalDate <= soon)
      .sort((a, b) => a.subscription!.renewalDate.getTime() - b.subscription!.renewalDate.getTime()),
  };
}
