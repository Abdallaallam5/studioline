import "server-only";
import { msg } from "@/lib/i18n/config";
import { OPEN_TASK_STATUSES } from "@/lib/constants";
import { addDays, formatDeadline } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { emailTemplates } from "@/lib/email/templates";
import { storageFor } from "@/lib/storage";
import { accessFor } from "@/lib/subscription/status";
import { formatMoney } from "@/lib/utils";
import { FileAsset, Subscription, Task, User, Workspace } from "@/models";
import { notify } from "./notifications";
import { loadPlatformSettings, syncWorkspaceStatus } from "./subscription";

/** Scheduled maintenance. Each job is idempotent, so running it twice is harmless. */

/** Move every billable workspace through ACTIVE → PAST_DUE → SUSPENDED as time passes. */
export async function syncAllSubscriptions(now = new Date()): Promise<number> {
  const settings = await loadPlatformSettings();
  const subscriptions = await Subscription.find().select("workspaceId").lean();
  for (const s of subscriptions) await syncWorkspaceStatus(String(s.workspaceId), { settings, now });
  return subscriptions.length;
}

/** Email managers whose renewal falls inside the "coming soon" window (once per renewal date). */
export async function sendRenewalReminders(now = new Date()): Promise<number> {
  const settings = await loadPlatformSettings();
  const due = await Subscription.find({
    cancelledAt: null,
    renewalDate: { $gt: now, $lte: addDays(now, settings.renewalSoonDays) },
    $expr: { $ne: ["$reminderSentFor", "$renewalDate"] },
  }).lean();

  let sent = 0;
  for (const subscription of due) {
    const workspace = await Workspace.findById(subscription.workspaceId).lean();
    const manager = workspace ? await User.findById(workspace.managerId).lean() : null;
    if (!workspace || !manager || workspace.disabledAt) continue;

    await notify({
      userId: String(manager._id),
      workspaceId: String(workspace._id),
      type: "SUBSCRIPTION",
      title: msg("Subscription renews on {d_date}", { d_date: subscription.renewalDate.toISOString() }),
      href: "/workspace/account",
    });
    await sendEmail({
      to: manager.email,
      ...emailTemplates.renewalReminder(manager.locale, { name: manager.name, workspaceName: workspace.name, renewalDate: subscription.renewalDate, amount: formatMoney(subscription.amountCents, settings.currency) }),
    });
    await Subscription.updateOne({ _id: subscription._id }, { $set: { reminderSentFor: subscription.renewalDate } });
    sent++;
  }
  return sent;
}

/** Notify assignees about deadlines in the next 24h and managers about newly overdue tasks. */
export async function sendDeadlineReminders(now = new Date()): Promise<{ dueSoon: number; overdue: number }> {
  const workspaces = await Workspace.find({ disabledAt: null }).select("accountStatus timezone managerId").lean();
  const usable = new Map(workspaces.filter((w) => accessFor(w.accountStatus).workspace).map((w) => [String(w._id), w]));
  const workspaceIds = [...usable.keys()];

  const dueSoon = await Task.find({
    workspaceId: { $in: workspaceIds },
    status: { $in: OPEN_TASK_STATUSES },
    deadline: { $gt: now, $lte: addDays(now, 1) },
    $expr: { $ne: ["$dueSoonNotifiedFor", "$deadline"] },
  }).lean();
  for (const task of dueSoon) {
    const tz = usable.get(String(task.workspaceId))!.timezone;
    await notify({
      userId: String(task.assigneeId),
      workspaceId: String(task.workspaceId),
      type: "DEADLINE",
      title: msg("Due soon: {title}", { title: task.title }),
      body: formatDeadline(task.deadline, tz, now),
      href: `/my/tasks/${task._id}`,
    });
    await Task.updateOne({ _id: task._id }, { $set: { dueSoonNotifiedFor: task.deadline } });
  }

  const overdue = await Task.find({
    workspaceId: { $in: workspaceIds },
    status: { $in: OPEN_TASK_STATUSES },
    deadline: { $lte: now },
    $expr: { $ne: ["$overdueNotifiedFor", "$deadline"] },
  }).lean();
  for (const task of overdue) {
    const workspace = usable.get(String(task.workspaceId))!;
    const workspaceId = String(task.workspaceId);
    await notify([
      { userId: String(task.assigneeId), workspaceId, type: "DEADLINE", title: msg("Overdue: {title}", { title: task.title }), href: `/my/tasks/${task._id}` },
      { userId: String(workspace.managerId), workspaceId, type: "DEADLINE", title: msg("Overdue: {title}", { title: task.title }), href: `/workspace/tasks/${task._id}` },
    ]);
    await Task.updateOne({ _id: task._id }, { $set: { overdueNotifiedFor: task.deadline } });
  }

  return { dueSoon: dueSoon.length, overdue: overdue.length };
}

/** Delete uploads that were never attached to anything (abandoned forms, removed attachments). */
export async function cleanUpOrphanedUploads(now = new Date()): Promise<number> {
  const orphans = await FileAsset.find({ attachedAt: null, createdAt: { $lt: addDays(now, -1) } }).limit(200).lean();
  let removed = 0;
  for (const file of orphans) {
    try {
      await storageFor(file).remove(file);
      await FileAsset.deleteOne({ _id: file._id, attachedAt: null });
      removed++;
    } catch (err) {
      console.error("[jobs] failed to remove orphaned upload:", err);
    }
  }
  return removed;
}
