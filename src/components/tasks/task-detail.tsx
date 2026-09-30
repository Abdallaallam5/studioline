import { ArrowLeft, Check, LifeBuoy, MessageCircle, Pencil, Play, Send, Trash2, Undo2 } from "lucide-react";
import { isValidObjectId } from "mongoose";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ActivityList } from "@/components/activity-list";
import { AttachmentList } from "@/components/files/attachment-list";
import { FileUploader } from "@/components/files/file-uploader";
import { ActionButton, ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Badge, HelpBadge, PriorityBadge, TaskStatusBadge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Avatar, Callout, Card, CardHeader } from "@/components/ui/primitives";
import { HELP_REASON_LABELS, HELP_REASONS } from "@/lib/constants";
import { appUrl, env } from "@/lib/env";
import { canEmployee, isOverdue } from "@/lib/tasks/workflow";
import { cn } from "@/lib/utils";
import { whatsappLink, whatsappMessages } from "@/lib/whatsapp";
import { ActivityLog, Comment, FileAsset, HelpRequest, Project, Submission, Task, User, type IFileAsset } from "@/models";
import { addComment, removeAttachment, replyToHelp, requestHelp, resolveHelp, reviewSubmission, startTask, submitTask } from "@/server/actions/tasks";
import type { WorkspaceContext } from "@/server/context";
import { getTaskFormOptions } from "@/server/task-data";
import { scope, taskScope } from "@/server/tenant";
import { ChecklistItem, StatusSelect } from "./task-controls";
import { TaskFormModal } from "./task-form";
import { getT } from "@/lib/i18n/server";

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-end">{children}</dd>
    </div>
  );
}

function WhatsAppButton({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "secondary", size: "sm", className: "w-full" })}>
      <MessageCircle /> {children}
    </a>
  );
}

/**
 * Full task page for both roles. The viewer's role decides which actions render;
 * the server actions re-check every permission independently.
 */
export async function TaskDetail({ ctx, taskId, backHref }: { ctx: WorkspaceContext; taskId: string; backHref: string }) {
  const t = await getT();
  if (!isValidObjectId(taskId)) notFound();
  // taskScope() limits employees to their own tasks; everything below hangs off this lookup.
  const task = await Task.findOne({ _id: taskId, ...taskScope(ctx) }).lean();
  if (!task) notFound();

  const isManager = ctx.user.role === "MANAGER";
  const canWrite = ctx.access.write;
  const tz = ctx.workspace.timezone;
  const base = scope(ctx);

  const [project, submissions, helpRequests, comments, members, activity, formOptions] = await Promise.all([
    Project.findOne({ _id: task.projectId, ...base }).select("name color").lean(),
    Submission.find({ ...base, taskId: task._id }).sort({ version: -1 }).lean(),
    HelpRequest.find({ ...base, taskId: task._id }).sort({ createdAt: -1 }).lean(),
    Comment.find({ ...base, taskId: task._id }).sort({ createdAt: 1 }).lean(),
    User.find(base).select("name phone role").lean(),
    isManager ? ActivityLog.find({ ...base, scope: "WORKSPACE", taskId: task._id }).sort({ createdAt: -1 }).limit(25).lean() : [],
    isManager ? getTaskFormOptions(ctx) : null,
  ]);

  const fileIds = [...task.attachmentIds, ...submissions.flatMap((s) => s.fileIds)];
  const files = fileIds.length ? await FileAsset.find({ _id: { $in: fileIds }, ...base }).lean() : [];
  const fileMap = new Map<string, IFileAsset>(files.map((f) => [String(f._id), f]));
  const pick = (ids: unknown[]) => ids.map((id) => fileMap.get(String(id))).filter((f): f is IFileAsset => Boolean(f));

  const nameOf = (id: unknown) => members.find((m) => String(m._id) === String(id))?.name ?? t("Former member");
  const assignee = members.find((m) => String(m._id) === String(task.assigneeId));
  const manager = members.find((m) => String(m._id) === ctx.workspace.managerId);

  const id = String(task._id);
  const overdue = isOverdue(task);
  const deadlineLabel = t.deadline(task.deadline, tz);
  const pendingSubmission = task.status === "SUBMITTED_FOR_REVIEW" ? submissions.find((s) => !s.review) : undefined;
  const latestReview = submissions.find((s) => s.review)?.review;
  const openHelp = helpRequests.filter((h) => h.status === "OPEN");
  const doneCount = task.checklist.filter((c) => c.done).length;
  const maxUploadMb = env().MAX_UPLOAD_MB;
  const closed = task.status === "COMPLETED" || task.status === "CANCELLED";

  // Click-to-chat links with a message that fits where the task is in its workflow.
  const assigneeFirstName = assignee?.name.split(" ")[0] ?? "";
  const employeeUrl = appUrl(`/my/tasks/${id}`);
  const managerMessage =
    task.status === "NEW"
      ? { label: t("Send to {name} on WhatsApp", { name: assigneeFirstName }), text: whatsappMessages.taskAssigned(t, { employeeName: assigneeFirstName, title: task.title, deadline: deadlineLabel, url: employeeUrl }) }
      : task.status === "CHANGES_REQUESTED"
        ? { label: t("Notify {name} on WhatsApp", { name: assigneeFirstName }), text: whatsappMessages.changesRequested(t, { employeeName: assigneeFirstName, title: task.title, url: employeeUrl }) }
        : { label: t("Remind {name} on WhatsApp", { name: assigneeFirstName }), text: whatsappMessages.taskReminder(t, { employeeName: assigneeFirstName, title: task.title, deadline: deadlineLabel, url: employeeUrl }) };
  const whatsapp = isManager
    ? whatsappLink(assignee?.phone, managerMessage.text)
    : whatsappLink(manager?.phone, whatsappMessages.askManager(t, { managerName: manager?.name.split(" ")[0] ?? "", title: task.title, url: appUrl(`/workspace/tasks/${id}`) }));

  return (
    <>
      <Link href={backHref} className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="rtl:rotate-180 size-3.5" /> {t("Back")}
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            {task.helpRequested && <HelpBadge />}
            {overdue && <Badge tone="red">{t("Overdue")}</Badge>}
          </div>
          <h1 className="text-xl font-semibold leading-snug sm:text-2xl">{task.title}</h1>
          {project && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted">
              <span className="size-2 rounded-sm" style={{ backgroundColor: project.color }} aria-hidden />
              {isManager ? (
                <Link href={`/workspace/projects/${task.projectId}`} className="hover:text-ink hover:underline">
                  {project.name}
                </Link>
              ) : (
                project.name
              )}
            </p>
          )}
        </div>

        {/* Primary actions */}
        {canWrite && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {isManager && formOptions && (
              <>
                <StatusSelect taskId={id} status={task.status} />
                <TaskFormModal
                  task={task}
                  projects={formOptions.projects}
                  employees={formOptions.employees}
                  timezone={tz}
                  maxUploadMb={maxUploadMb}
                  trigger={
                    <Button variant="secondary">
                      <Pencil /> {t("Edit")}
                    </Button>
                  }
                />
              </>
            )}
            {!isManager && (
              <>
                {canEmployee("requestHelp", task.status) && (
                  <Modal
                    title={t("Need help?")}
                    description={t("Your manager is notified and the task is marked as “Help requested”.")}
                    trigger={
                      <Button variant="secondary">
                        <LifeBuoy /> {t("Need help")}
                      </Button>
                    }
                  >
                    <ActionForm action={requestHelp} hidden={{ taskId: id }} className="space-y-4">
                      <Field label={t("What's the problem?")} name="reason">
                        <Select name="reason" defaultValue="" required>
                          <option value="" disabled>
                            {t("Select a reason…")}
                          </option>
                          {HELP_REASONS.map((r) => (
                            <option key={r} value={r}>
                              {t(HELP_REASON_LABELS[r])}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label={t("Message")} name="message" hint={t("Be specific so your manager can unblock you quickly.")}>
                        <Textarea name="message" rows={4} maxLength={3000} required />
                      </Field>
                      <div className="flex justify-end">
                        <SubmitButton>{t("Send request")}</SubmitButton>
                      </div>
                    </ActionForm>
                  </Modal>
                )}
                {canEmployee("start", task.status) && (
                  <ActionButton action={startTask} fields={{ taskId: id }} variant={task.status === "NEW" ? "primary" : "secondary"}>
                    <Play /> {task.status === "NEW" ? t("Start task") : t("Resume work")}
                  </ActionButton>
                )}
                {canEmployee("submit", task.status) && (
                  <Modal
                    size="lg"
                    title={t("Submit for review")}
                    description={t("Your manager is notified. Earlier submissions stay in the history.")}
                    trigger={
                      <Button variant={task.status === "NEW" ? "secondary" : "primary"}>
                        <Send /> {t("Submit for review")}
                      </Button>
                    }
                  >
                    <ActionForm action={submitTask} hidden={{ taskId: id }} className="space-y-4">
                      <Field label={t("Submission note")} name="note" optional hint={t("What did you do, and is there anything the reviewer should know?")}>
                        <Textarea name="note" rows={4} maxLength={5000} />
                      </Field>
                      <Field label={t("Files")} name="fileIds" as="div" hint={t("Images, videos, documents and design files.")}>
                        <FileUploader maxMb={maxUploadMb} />
                      </Field>
                      <div className="flex justify-end">
                        <SubmitButton>{t("Submit for review")}</SubmitButton>
                      </div>
                    </ActionForm>
                  </Modal>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Status-specific guidance */}
      <div className="mb-6 space-y-3 empty:hidden">
        {!isManager && task.status === "CHANGES_REQUESTED" && latestReview && (
          <Callout tone="warn" icon={<Undo2 />} title={t("{name} requested changes", { name: nameOf(latestReview.reviewerId) })}>
            <p className="whitespace-pre-wrap">{latestReview.feedback}</p>
          </Callout>
        )}
        {!isManager && task.status === "SUBMITTED_FOR_REVIEW" && <Callout icon={<Send />} title={t("Waiting for review")}>{t("You'll be notified as soon as your manager approves it or requests changes.")}</Callout>}
        {!isManager && task.status === "COMPLETED" && <Callout icon={<Check />} title={t("Approved and completed")}>{t("Nice work — nothing more to do here.")}</Callout>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          {/* Review panel (manager) */}
          {isManager && pendingSubmission && (
            <Card className="border-violet-200 ring-1 ring-violet-100">
              <CardHeader title={t("Review submission v{version}", { version: pendingSubmission.version })} description={t("Submitted by {name} · {when}", { name: nameOf(pendingSubmission.submittedBy), when: t.ago(pendingSubmission.createdAt) })} />
              <div className="space-y-4 p-4">
                {pendingSubmission.note && <p className="whitespace-pre-wrap text-sm leading-relaxed">{pendingSubmission.note}</p>}
                <AttachmentList files={pick(pendingSubmission.fileIds)} />
                {canWrite && (
                  <ActionForm action={reviewSubmission} hidden={{ taskId: id }} className="space-y-3 border-t border-line pt-4">
                    <Field label={t("Feedback")} name="feedback" hint={t("Required when requesting changes; optional when approving.")}>
                      <Textarea name="feedback" rows={3} maxLength={5000} placeholder={t("What should change, or what worked well?")} />
                    </Field>
                    <div className="flex flex-wrap justify-end gap-2">
                      <SubmitButton variant="secondary" name="decision" value="CHANGES_REQUESTED">
                        <Undo2 /> {t("Request changes")}
                      </SubmitButton>
                      <SubmitButton name="decision" value="APPROVED">
                        <Check /> {t("Approve")}
                      </SubmitButton>
                    </div>
                  </ActionForm>
                )}
              </div>
            </Card>
          )}

          {/* Open help requests */}
          {openHelp.length > 0 && (
            <Card className="border-red-200">
              <CardHeader title={t("Help requested")} description={isManager ? t("Reply to unblock the work, then mark it resolved.") : t("Your manager has been notified.")} />
              <div className="divide-y divide-line">
                {openHelp.map((help) => (
                  <HelpThread key={String(help._id)} help={help} nameOf={nameOf} canWrite={canWrite} canResolve />
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title={t("Description")} />
            <div className="p-4">
              {task.description ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{task.description}</p> : <p className="text-sm text-muted">{t("No description provided.")}</p>}
            </div>
          </Card>

          {task.checklist.length > 0 && (
            <Card>
              <CardHeader title={t("Checklist")} action={<span className="text-xs tabular-nums text-muted">{doneCount}/{task.checklist.length} {t("done")}</span>} />
              <div className="p-3">
                {task.checklist.map((item) => (
                  <ChecklistItem key={String(item._id)} taskId={id} itemId={String(item._id)} text={item.text} done={item.done} disabled={!canWrite || closed} />
                ))}
              </div>
            </Card>
          )}

          {task.attachmentIds.length > 0 && (
            <Card>
              <CardHeader title={t("Attachments")} description={t("Files provided with the brief")} />
              <div className="p-4">
                <AttachmentList
                  files={pick(task.attachmentIds)}
                  action={
                    isManager && canWrite
                      ? (file) => (
                          <ActionButton
                            action={removeAttachment}
                            fields={{ taskId: id, fileId: String(file._id) }}
                            confirm={t('Remove "{name}" from this task?', { name: file.originalName })}
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted hover:text-danger"
                            aria-label={t("Remove {name}", { name: file.originalName })}
                          >
                            <Trash2 />
                          </ActionButton>
                        )
                      : undefined
                  }
                />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title={t("Submission history")} description={t("Every submission is kept — nothing is overwritten.")} />
            {submissions.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">{isManager ? t("Nothing has been submitted yet.") : t("You haven't submitted this task yet.")}</p>
            ) : (
              <ol className="divide-y divide-line">
                {submissions.map((s) => (
                  <li key={String(s._id)} className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-ink/[0.06] px-1.5 py-0.5 font-mono text-xs font-medium">v{s.version}</span>
                      <span className="text-sm font-medium">{nameOf(s.submittedBy)}</span>
                      <span className="text-xs text-muted" title={t.dateTime(s.createdAt, tz)}>
                        {t.ago(s.createdAt)}
                      </span>
                      <span className="ms-auto">
                        {s.review ? <Badge tone={s.review.decision === "APPROVED" ? "green" : "amber"}>{s.review.decision === "APPROVED" ? t("Approved") : t("Changes requested")}</Badge> : <Badge tone="violet">{t("Awaiting review")}</Badge>}
                      </span>
                    </div>
                    {s.note && <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{s.note}</p>}
                    <AttachmentList files={pick(s.fileIds)} />
                    {s.review?.feedback && (
                      <div className="rounded-lg bg-paper px-3 py-2.5 text-sm">
                        <p className="text-xs font-medium text-muted">
                          {t("Feedback from")} {nameOf(s.review.reviewerId)} · {t.ago(s.review.reviewedAt)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap leading-relaxed">{s.review.feedback}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <CardHeader title={t("Comments")} />
            {comments.length > 0 && (
              <ul className="divide-y divide-line">
                {comments.map((c) => (
                  <li key={String(c._id)} className="flex gap-3 p-4">
                    <Avatar name={nameOf(c.authorId)} size="sm" className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px]">
                        <span className="font-medium">{nameOf(c.authorId)}</span>
                        <span className="ms-2 text-xs text-muted" title={t.dateTime(c.createdAt, tz)}>
                          {t.ago(c.createdAt)}
                        </span>
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {canWrite ? (
              <ActionForm action={addComment} hidden={{ taskId: id }} className={cn("p-4", comments.length > 0 && "border-t border-line")}>
                <Field label={t("Add a comment")} name="body">
                  <Textarea name="body" rows={2} maxLength={5000} placeholder={isManager ? t("Add context or answer a question…") : t("Ask a question or share an update…")} />
                </Field>
                <div className="mt-3 flex justify-end">
                  <SubmitButton size="sm">{t("Comment")}</SubmitButton>
                </div>
              </ActionForm>
            ) : (
              comments.length === 0 && <p className="px-4 py-6 text-sm text-muted">{t("No comments.")}</p>
            )}
          </Card>

          {helpRequests.some((h) => h.status === "RESOLVED") && (
            <Card>
              <CardHeader title={t("Resolved help requests")} />
              <div className="divide-y divide-line">
                {helpRequests
                  .filter((h) => h.status === "RESOLVED")
                  .map((help) => (
                    <HelpThread key={String(help._id)} help={help} nameOf={nameOf} canWrite={false} />
                  ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <Card>
            <CardHeader title={t("Details")} />
            <dl className="divide-y divide-line">
              <Meta label={t("Assignee")}>
                <span className="inline-flex items-center gap-2">
                  <Avatar name={assignee?.name ?? "?"} size="sm" />
                  <span className="truncate">{assignee?.name ?? t("Former member")}</span>
                </span>
              </Meta>
              <Meta label={t("Deadline")}>
                <span className={cn(overdue && "font-medium text-danger")} title={task.deadline ? t.dateTime(task.deadline, tz) : undefined}>
                  {deadlineLabel}
                </span>
              </Meta>
              <Meta label={t("Priority")}>
                <PriorityBadge priority={task.priority} />
              </Meta>
              {task.tags.length > 0 && (
                <Meta label={t("Tags")}>
                  <span className="flex flex-wrap justify-end gap-1">
                    {task.tags.map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </span>
                </Meta>
              )}
              <Meta label={t("Created")}>{t.dateTime(task.createdAt, tz)}</Meta>
              {task.startedAt && <Meta label={t("Started")}>{t.dateTime(task.startedAt, tz)}</Meta>}
              {task.completedAt && <Meta label={t("Completed")}>{t.dateTime(task.completedAt, tz)}</Meta>}
            </dl>
            {whatsapp && !closed && (
              <div className="border-t border-line p-3">
                <WhatsAppButton href={whatsapp}>{isManager ? managerMessage.label : t("Ask your manager on WhatsApp")}</WhatsAppButton>
              </div>
            )}
          </Card>

          {isManager && (
            <Card>
              <CardHeader title={t("Activity")} />
              <ActivityList items={activity} timezone={tz} />
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

async function HelpThread({
  help,
  nameOf,
  canWrite,
  canResolve,
}: {
  help: { _id: unknown; requesterId: unknown; reason: keyof typeof HELP_REASON_LABELS; message: string; createdAt: Date; replies: { _id: unknown; authorId: unknown; body: string; createdAt: Date }[] };
  nameOf: (id: unknown) => string;
  canWrite: boolean;
  canResolve?: boolean;
}) {
  const t = await getT();
  const helpId = String(help._id);
  return (
    <div className="space-y-3 p-4">
      <div>
        <p className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="font-medium">{nameOf(help.requesterId)}</span>
          <Badge tone="red">{t(HELP_REASON_LABELS[help.reason])}</Badge>
          <span className="text-xs text-muted">{t.ago(help.createdAt)}</span>
        </p>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{help.message}</p>
      </div>
      {help.replies.length > 0 && (
        <ul className="space-y-2 border-s-2 border-line ps-3">
          {help.replies.map((reply) => (
            <li key={String(reply._id)} className="text-sm">
              <p className="text-[13px]">
                <span className="font-medium">{nameOf(reply.authorId)}</span>
                <span className="ms-2 text-xs text-muted">{t.ago(reply.createdAt)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap leading-relaxed text-ink-soft">{reply.body}</p>
            </li>
          ))}
        </ul>
      )}
      {canWrite && (
        <ActionForm action={replyToHelp} hidden={{ helpId }}>
          <Field label={t("Reply")} name="body">
            <Textarea name="body" rows={2} maxLength={3000} />
          </Field>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {canResolve && (
              <ActionButton action={resolveHelp} fields={{ helpId }} variant="secondary" size="sm">
                <Check /> {t("Mark resolved")}
              </ActionButton>
            )}
            <SubmitButton size="sm">{t("Reply")}</SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
