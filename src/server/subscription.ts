import "server-only";
import { msg } from "@/lib/i18n/config";
import { cache } from "react";
import { ACCOUNT_STATUS_LABELS, type WorkspaceStatus } from "@/lib/constants";
import { queueEmail } from "@/lib/email";
import { emailTemplates } from "@/lib/email/templates";
import { appUrl } from "@/lib/env";
import { computeWorkspaceStatus, suspensionDate } from "@/lib/subscription/status";
import {
  PLATFORM_SETTINGS_DEFAULTS,
  PlatformSettings,
  Subscription,
  User,
  Workspace,
  type IPlatformSettings,
  type ISubscription,
  type IWorkspace,
} from "@/models";
import { logPlatform, SYSTEM_ACTOR, type Actor } from "./activity";
import { notify } from "./notifications";

export type Settings = Pick<IPlatformSettings, "gracePeriodDays" | "defaultPriceCents" | "currency" | "renewalSoonDays">;

export async function loadPlatformSettings(): Promise<Settings> {
  const doc = await PlatformSettings.findOne({ key: "platform" }).lean();
  return {
    gracePeriodDays: doc?.gracePeriodDays ?? PLATFORM_SETTINGS_DEFAULTS.gracePeriodDays,
    defaultPriceCents: doc?.defaultPriceCents ?? PLATFORM_SETTINGS_DEFAULTS.defaultPriceCents,
    currency: doc?.currency ?? PLATFORM_SETTINGS_DEFAULTS.currency,
    renewalSoonDays: doc?.renewalSoonDays ?? PLATFORM_SETTINGS_DEFAULTS.renewalSoonDays,
  };
}

/** Request-scoped cache of platform settings. */
export const getPlatformSettings = cache(loadPlatformSettings);

/**
 * Recompute a workspace's status from its subscription and persist it when it
 * changed. Called on every protected request (via the guards), after every
 * owner billing action, and by the daily cron — so the stored status is always
 * current without any of those callers re-implementing the rules.
 */
export async function syncWorkspaceStatus(
  workspaceId: string,
  opts: { actor?: Actor; now?: Date; settings?: Settings } = {},
): Promise<IWorkspace | null> {
  const now = opts.now ?? new Date();
  const [workspace, subscription, settings] = await Promise.all([
    Workspace.findById(workspaceId).lean(),
    Subscription.findOne({ workspaceId }).lean(),
    opts.settings ?? loadPlatformSettings(),
  ]);
  if (!workspace) return null;

  const next = computeWorkspaceStatus({
    subscription,
    manualSuspendedAt: workspace.manualSuspendedAt,
    gracePeriodDays: settings.gracePeriodDays,
    now,
  });
  const previous = workspace.accountStatus;
  if (next === previous) return workspace;

  // Compare-and-set so concurrent requests produce exactly one transition event.
  const result = await Workspace.updateOne({ _id: workspace._id, accountStatus: previous }, { $set: { accountStatus: next } });
  if (result.modifiedCount === 1) {
    await onStatusChanged(workspace, previous, next, subscription, settings, opts.actor ?? SYSTEM_ACTOR);
  }
  return { ...workspace, accountStatus: next };
}

/**
 * Bring stored statuses up to date for workspaces whose billing clock has moved
 * on since they were last visited. Owner pages call this so their lists never
 * show a stale "Active" for a workspace that is actually past due.
 */
export const refreshStaleStatuses = cache(async (): Promise<void> => {
  const overdue = await Subscription.find({ cancelledAt: null, renewalDate: { $lte: new Date() } }).select("workspaceId").lean();
  if (overdue.length === 0) return;
  const stale = await Workspace.find({ _id: { $in: overdue.map((s) => s.workspaceId) }, accountStatus: { $in: ["ACTIVE", "PAST_DUE"] } })
    .select("_id")
    .lean();
  const settings = await getPlatformSettings();
  for (const workspace of stale) await syncWorkspaceStatus(String(workspace._id), { settings });
});

async function onStatusChanged(
  workspace: IWorkspace,
  previous: WorkspaceStatus,
  next: WorkspaceStatus,
  subscription: ISubscription | null,
  settings: Settings,
  actor: Actor,
): Promise<void> {
  const workspaceId = String(workspace._id);
  await logPlatform(
    "ACCOUNT_STATUS_CHANGED",
    msg("{workspace}: {t_from} → {t_to}", { workspace: workspace.name, t_from: ACCOUNT_STATUS_LABELS[previous], t_to: ACCOUNT_STATUS_LABELS[next] }),
    actor,
    workspaceId,
    { previous, next },
  );

  const manager = await User.findById(workspace.managerId).lean();
  if (!manager) return;
  const accountUrl = appUrl("/workspace/account");

  if (next === "PAST_DUE" && subscription) {
    await notify({
      userId: String(manager._id),
      workspaceId,
      type: "SUBSCRIPTION",
      title: msg("Your subscription is past due"),
      body: msg("The workspace will be suspended on {d_date} unless payment is received.", { d_date: suspensionDate(subscription.renewalDate, settings.gracePeriodDays).toISOString() }),
      href: "/workspace/account",
    });
    await queueEmail({
      to: manager.email,
      ...emailTemplates.subscriptionPastDue(manager.locale, { name: manager.name, workspaceName: workspace.name, suspensionDate: suspensionDate(subscription.renewalDate, settings.gracePeriodDays), accountUrl }),
    });
  } else if (next === "SUSPENDED") {
    await notify({
      userId: String(manager._id),
      workspaceId,
      type: "SUBSCRIPTION",
      title: msg("Your workspace has been suspended"),
      body: msg("Your data is preserved. Access is restored when the subscription is renewed."),
      href: "/workspace/account",
    });
    await queueEmail({ to: manager.email, ...emailTemplates.subscriptionSuspended(manager.locale, { name: manager.name, workspaceName: workspace.name, accountUrl }) });
  } else if (next === "ACTIVE") {
    await notify({
      userId: String(manager._id),
      workspaceId,
      type: "SUBSCRIPTION",
      title: msg("Your subscription is active"),
      body: subscription ? msg("Next renewal: {d_date}.", { d_date: subscription.renewalDate.toISOString() }) : null,
      href: "/workspace/account",
    });
  }
}
