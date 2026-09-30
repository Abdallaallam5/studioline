/**
 * Development-only sample data: one active workspace with a manager, three
 * employees, two projects and tasks in every state of the workflow.
 *
 *   npm run seed:demo
 *
 * All demo accounts share one password: DEMO_PASSWORD from the environment, or
 * a random one that is printed once. Re-running replaces the previous demo data.
 */
import "./load-env";
import { randomBytes } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { hashPassword } from "@/lib/auth/crypto";
import { connectDb } from "@/lib/db";
import { ActivityLog, Comment, HelpRequest, Notification, Payment, Project, Submission, Subscription, Task, User, Workspace } from "@/models";

const DEMO_DOMAIN = "demo.studioline.test";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production.");
  await connectDb();

  // Remove any previous demo workspace (identified by the reserved demo domain).
  const previous = await User.findOne({ email: `manager@${DEMO_DOMAIN}` });
  if (previous?.workspaceId) {
    const workspaceId = previous.workspaceId;
    await Promise.all([
      ...[Project, Task, Comment, HelpRequest, Submission, Notification, ActivityLog, Payment, Subscription].map((model) =>
        (model as typeof Task).deleteMany({ workspaceId }),
      ),
      User.deleteMany({ workspaceId }),
      Workspace.deleteOne({ _id: workspaceId }),
    ]);
  }

  const password = process.env.DEMO_PASSWORD || `${randomBytes(9).toString("base64url")}a1`;
  const passwordHash = await hashPassword(password);
  const now = new Date();
  const workspaceId = new Types.ObjectId();
  const managerId = new Types.ObjectId();

  await Workspace.create({ _id: workspaceId, name: "Northwind Creative", managerId, timezone: "Europe/London", accountStatus: "ACTIVE" });
  await User.create({ _id: managerId, name: "Dana Whitfield", email: `manager@${DEMO_DOMAIN}`, phone: "+447700900101", passwordHash, role: "MANAGER", workspaceId, emailVerifiedAt: now });

  const [lina, omar, maya] = await User.create(
    [
      { name: "Lina Haddad", jobTitle: "Designer", phone: "+447700900102" },
      { name: "Omar Nasser", jobTitle: "Copywriter", phone: "+447700900103" },
      { name: "Maya Chen", jobTitle: "Performance marketer", phone: null },
    ].map((e) => ({ ...e, email: `${e.name.split(" ")[0].toLowerCase()}@${DEMO_DOMAIN}`, passwordHash, role: "EMPLOYEE" as const, workspaceId, emailVerifiedAt: now })),
  );

  const owner = await User.findOne({ role: "OWNER" });
  const subscription = await Subscription.create({
    workspaceId,
    amountCents: 4900,
    startDate: new Date(now.getTime() - 40 * DAY),
    renewalDate: new Date(now.getTime() + 20 * DAY),
    activatedAt: new Date(now.getTime() - 40 * DAY),
  });
  await Payment.create({
    workspaceId,
    subscriptionId: subscription._id,
    amountCents: 4900,
    paidAt: new Date(now.getTime() - 10 * DAY),
    method: "BANK_TRANSFER",
    reference: "DEMO-0001",
    periodStart: new Date(now.getTime() - 10 * DAY),
    periodEnd: subscription.renewalDate,
    recordedBy: owner?._id ?? managerId,
  });

  const [launch, retainer] = await Project.create([
    { workspaceId, name: "Spring product launch", clientName: "Aurora Skincare", status: "ACTIVE", color: "#1f5f4f", memberIds: [lina._id, omar._id, maya._id], startDate: new Date(now.getTime() - 14 * DAY), endDate: new Date(now.getTime() + 30 * DAY), createdBy: managerId, description: "Campaign assets and paid media for the spring range." },
    { workspaceId, name: "Monthly social retainer", clientName: "Harbor Coffee", status: "ACTIVE", color: "#2f5fb3", memberIds: [lina._id, omar._id], createdBy: managerId },
  ]);

  const base = { workspaceId, createdBy: managerId };
  const tasks = await Task.create([
    { ...base, projectId: launch._id, title: "Design the campaign hero banner", assigneeId: lina._id, priority: "HIGH", status: "SUBMITTED_FOR_REVIEW", deadline: new Date(now.getTime() + 6 * HOUR), startedAt: new Date(now.getTime() - 2 * DAY), submittedAt: new Date(now.getTime() - 3 * HOUR), description: "Hero banner for the landing page in desktop and mobile crops.", checklist: [{ text: "Desktop 1920×800", done: true }, { text: "Mobile 1080×1350", done: true }], tags: ["design"] },
    { ...base, projectId: launch._id, title: "Write paid social copy — round 2", assigneeId: omar._id, priority: "MEDIUM", status: "IN_PROGRESS", deadline: new Date(now.getTime() + 1 * DAY), startedAt: new Date(now.getTime() - 1 * DAY), helpRequested: true, tags: ["copy", "social"] },
    { ...base, projectId: launch._id, title: "Landing page QA checklist", assigneeId: maya._id, priority: "URGENT", status: "CHANGES_REQUESTED", deadline: new Date(now.getTime() - 5 * HOUR), startedAt: new Date(now.getTime() - 3 * DAY), submittedAt: new Date(now.getTime() - 1 * DAY) },
    { ...base, projectId: launch._id, title: "Set up conversion tracking", assigneeId: maya._id, priority: "HIGH", status: "NEW", deadline: new Date(now.getTime() + 3 * DAY) },
    { ...base, projectId: retainer._id, title: "June content calendar", assigneeId: omar._id, priority: "MEDIUM", status: "NEW", deadline: new Date(now.getTime() + 5 * DAY) },
    { ...base, projectId: retainer._id, title: "Instagram carousel — new blend", assigneeId: lina._id, priority: "LOW", status: "COMPLETED", deadline: new Date(now.getTime() - 2 * DAY), startedAt: new Date(now.getTime() - 5 * DAY), submittedAt: new Date(now.getTime() - 3 * DAY), completedAt: new Date(now.getTime() - 2 * DAY) },
    { ...base, projectId: retainer._id, title: "Monthly performance report", assigneeId: maya._id, priority: "LOW", status: "BLOCKED", deadline: new Date(now.getTime() + 8 * DAY), startedAt: new Date(now.getTime() - 1 * DAY) },
  ]);
  const [hero, copy, qa, , , carousel] = tasks;

  await Submission.create([
    { workspaceId, taskId: hero._id, submittedBy: lina._id, version: 1, note: "Both crops attached in the shared folder. Used the approved palette and the new product shot." },
    { workspaceId, taskId: qa._id, submittedBy: maya._id, version: 1, note: "Checked all breakpoints and forms.", review: { decision: "CHANGES_REQUESTED", feedback: "The checkout form still fails on Safari iOS — please retest and add screenshots.", reviewerId: managerId, reviewedAt: new Date(now.getTime() - 20 * HOUR) } },
    { workspaceId, taskId: carousel._id, submittedBy: lina._id, version: 1, note: "Five slides, final copy applied.", review: { decision: "APPROVED", feedback: "Great work.", reviewerId: managerId, reviewedAt: new Date(now.getTime() - 2 * DAY) } },
  ]);
  await HelpRequest.create({ workspaceId, taskId: copy._id, requesterId: omar._id, reason: "CLARIFICATION", message: "Should the copy mention the launch discount, or is that being announced separately?" });
  await Comment.create({ workspaceId, taskId: hero._id, authorId: managerId, body: "Please keep the logo clear of the bottom-right corner — the CTA sits there on mobile." });
  await Notification.create([
    { userId: managerId, workspaceId, type: "TASK_SUBMITTED", title: `Ready for review: ${hero.title}`, body: "Submitted by Lina Haddad", href: `/workspace/tasks/${hero._id}` },
    { userId: managerId, workspaceId, type: "HELP_REQUESTED", title: `Omar Nasser needs help: ${copy.title}`, body: "Need clarification", href: `/workspace/tasks/${copy._id}` },
    { userId: maya._id, workspaceId, type: "CHANGES_REQUESTED", title: `Changes requested: ${qa.title}`, href: `/my/tasks/${qa._id}` },
  ]);

  console.log("\nDemo workspace “Northwind Creative” is ready.\n");
  console.log(`  Manager:   manager@${DEMO_DOMAIN}`);
  console.log(`  Employees: lina@${DEMO_DOMAIN}, omar@${DEMO_DOMAIN}, maya@${DEMO_DOMAIN}`);
  console.log(process.env.DEMO_PASSWORD ? "  Password:  (DEMO_PASSWORD from your environment)\n" : `  Password:  ${password}   ← generated, shown once\n`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
