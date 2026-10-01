import { ClipboardCheck, Paperclip } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PriorityBadge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Avatar, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { Submission, Task } from "@/models";
import { requireManager } from "@/server/context";
import { findTasks, withRefs } from "@/server/task-data";
import { scope } from "@/server/tenant";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Review" };

export default async function ReviewInboxPage() {
  const t = await getT();
  const ctx = await requireManager();
  const base = scope(ctx);

  // Oldest first: the submission that has waited longest is on top.
  const waiting = await findTasks(ctx, { status: "SUBMITTED_FOR_REVIEW" }, { sort: { submittedAt: 1 } });
  const [pending, reviewed] = await Promise.all([
    Submission.find({ ...base, taskId: { $in: waiting.map((w) => w.task._id) }, review: null }).sort({ version: -1 }).lean(),
    Submission.find({ ...base, review: { $ne: null } }).sort({ "review.reviewedAt": -1 }).limit(8).lean(),
  ]);
  const submissionFor = (taskId: unknown) => pending.find((s) => String(s.taskId) === String(taskId));

  const reviewedTasks = await withRefs(ctx, await Task.find({ ...base, _id: { $in: reviewed.map((r) => r.taskId) } }).lean());
  const taskFor = (taskId: unknown) => reviewedTasks.find((t) => String(t.task._id) === String(taskId));

  return (
    <>
      <PageHeader title={t("Review inbox")} description={t("Submitted work waiting for your decision, oldest first.")} />

      {waiting.length === 0 ? (
        <Card>
          <EmptyState icon={<ClipboardCheck />} title={t("You're all caught up")} description={t("When someone submits a task for review, it lands here.")} />
        </Card>
      ) : (
        <div className="stagger space-y-3">
          {waiting.map(({ task, project, assignee }) => {
            const submission = submissionFor(task._id);
            return (
              <Card key={String(task._id)} className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <Avatar name={assignee?.name ?? "?"} className="mt-0.5" />
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-semibold">{task.title}</h2>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span>{assignee?.name}</span>
                        {project && <span>· {project.name}</span>}
                        {task.submittedAt && <span>{t("· submitted")} {t.ago(task.submittedAt)}</span>}
                      </p>
                      {submission?.note && <p dir="auto" className="mt-2.5 line-clamp-2 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{submission.note}</p>}
                      <div className="mt-2.5 flex flex-wrap items-center gap-3">
                        {submission && <Badge tone="violet">{t("Submission v")}{submission.version}</Badge>}
                        {submission && submission.fileIds.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted">
                            <Paperclip className="size-3.5" />
                            {t.n(submission.fileIds.length, "file")}
                          </span>
                        )}
                        <PriorityBadge priority={task.priority} />
                      </div>
                    </div>
                  </div>
                  <Link href={`/workspace/tasks/${task._id}`} className={buttonClass({ className: "shrink-0" })}>
                    {t("Open submission")}
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {reviewed.length > 0 && (
        <Card className="mt-8">
          <CardHeader title={t("Recently reviewed")} />
          <ul className="divide-y divide-line">
            {reviewed.map((s) => {
              const ref = taskFor(s.taskId);
              if (!ref || !s.review) return null;
              return (
                <li key={String(s._id)}>
                  <Link href={`/workspace/tasks/${s.taskId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper/70">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{ref.task.title}</p>
                      <p className="truncate text-xs text-muted">
                        {ref.assignee?.name} · v{s.version} · {t.ago(s.review.reviewedAt)}
                      </p>
                    </div>
                    <Badge tone={s.review.decision === "APPROVED" ? "green" : "amber"}>{s.review.decision === "APPROVED" ? t("Approved") : t("Changes requested")}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
