import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TaskList } from "@/components/tasks/task-list";
import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { dayKey, zonedParts, zonedTimeToUtc } from "@/lib/dates";
import { isOverdue } from "@/lib/tasks/workflow";
import { cn } from "@/lib/utils";
import { requireManager } from "@/server/context";
import { findTasks, type TaskView } from "@/server/task-data";
import { intlLocale } from "@/lib/i18n/config";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Calendar" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_PER_DAY = 3;
const pad = (n: number) => String(n).padStart(2, "0");

const statusDot: Record<string, string> = {
  COMPLETED: "bg-emerald-500",
  SUBMITTED_FOR_REVIEW: "bg-violet-500",
  BLOCKED: "bg-red-500",
  CHANGES_REQUESTED: "bg-amber-500",
  IN_PROGRESS: "bg-sky-500",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const t = await getT();
  const ctx = await requireManager();
  const tz = ctx.workspace.timezone;
  const now = new Date();
  const todayParts = zonedParts(now, tz);

  const match = /^(\d{4})-(\d{2})$/.exec((await searchParams).month ?? "");
  const year = match ? Math.min(Math.max(Number(match[1]), 2000), 2100) : todayParts.year;
  const month = match ? Math.min(Math.max(Number(match[2]), 1), 12) : todayParts.month;

  // Month boundaries in the workspace timezone; JS normalises month 13 to January.
  const start = zonedTimeToUtc(year, month, 1, 0, 0, tz);
  const end = zonedTimeToUtc(year, month + 1, 1, 0, 0, tz);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;

  const items = await findTasks(ctx, { deadline: { $gte: start, $lt: end }, status: { $ne: "CANCELLED" } }, { limit: 500 });
  const byDay = new Map<string, TaskView[]>();
  for (const item of items) {
    const key = dayKey(item.task.deadline!, tz);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  const monthParam = (offset: number) => {
    const d = new Date(Date.UTC(year, month - 1 + offset, 1));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  };
  const title = new Intl.DateTimeFormat(intlLocale(t.locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  const todayKey = dayKey(now, tz);
  const cells: (number | null)[] = [...Array<null>(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <>
      <PageHeader
        title={title}
        description={t("Task deadlines, shown in workspace time ({tz}).", { tz: tz.replaceAll("_", " ") })}
        actions={
          <>
            <Link href={`/workspace/calendar?month=${monthParam(-1)}`} className={buttonClass({ variant: "secondary", size: "icon" })} aria-label={t("Previous month")}>
              <ChevronLeft className="rtl:rotate-180" />
            </Link>
            <Link href="/workspace/calendar" className={buttonClass({ variant: "secondary" })}>
              {t("Today")}
            </Link>
            <Link href={`/workspace/calendar?month=${monthParam(1)}`} className={buttonClass({ variant: "secondary", size: "icon" })} aria-label={t("Next month")}>
              <ChevronRight className="rtl:rotate-180" />
            </Link>
          </>
        }
      />

      {/* Month grid (tablet and up) */}
      <Card className="hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b border-line bg-paper/60">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-medium text-muted">
              {t(d)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const key = day ? `${year}-${pad(month)}-${pad(day)}` : null;
            const tasks = key ? (byDay.get(key) ?? []) : [];
            return (
              <div key={i} className={cn("min-h-28 border-b border-e border-line p-1.5 [&:nth-child(7n)]:border-e-0", !day && "bg-paper/50")}>
                {day && (
                  <>
                    <p className={cn("mb-1 flex size-6 items-center justify-center rounded-full text-xs tabular-nums", key === todayKey ? "bg-brand font-semibold text-white" : "text-ink-soft")}>{day}</p>
                    <ul className="space-y-0.5">
                      {tasks.slice(0, MAX_PER_DAY).map(({ task, assignee }) => (
                        <li key={String(task._id)}>
                          <Link
                            href={`/workspace/tasks/${task._id}`}
                            title={`${task.title}${assignee ? ` — ${assignee.name}` : ""}`}
                            className={cn("flex items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-ink/5", isOverdue(task, now) && "text-danger", task.status === "COMPLETED" && "text-muted line-through")}
                          >
                            <span className={cn("size-1.5 shrink-0 rounded-full", statusDot[task.status] ?? "bg-stone-400")} aria-hidden />
                            <span className="truncate">{task.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {tasks.length > MAX_PER_DAY && <p className="mt-0.5 px-1 text-[11px] text-muted">+{tasks.length - MAX_PER_DAY} {t("more")}</p>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Agenda (phones) */}
      <div className="space-y-4 md:hidden">
        {byDay.size === 0 ? (
          <Card>
            <EmptyState icon={<CalendarDays />} title={t("No deadlines this month")} />
          </Card>
        ) : (
          [...byDay.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, tasks]) => (
              <Card key={key}>
                <p className={cn("border-b border-line px-4 py-2 text-[13px] font-semibold", key === todayKey && "text-brand")}>
                  {new Intl.DateTimeFormat(intlLocale(t.locale), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`))}
                </p>
                <TaskList items={tasks} hrefBase="/workspace/tasks" timezone={tz} compact />
              </Card>
            ))
        )}
      </div>
    </>
  );
}
