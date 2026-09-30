import type { Metadata } from "next";
import { EmployeeTaskPage } from "@/components/tasks/employee-task-page";
import { OPEN_TASK_STATUSES } from "@/lib/constants";
import { dayRange } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "My day" };

export default async function MyDayPage() {
  const t = await getT();
  return (
    <EmployeeTaskPage
      title={t("My day")}
      description={t("What to focus on today.")}
      sections={(now, tz) => {
        const today = dayRange(tz, now);
        return [
          { title: t("Overdue"), description: t("Past the deadline"), filter: { status: { $in: OPEN_TASK_STATUSES }, deadline: { $lt: today.start } }, hideWhenEmpty: true },
          {
            title: t("Due today"),
            filter: { status: { $in: OPEN_TASK_STATUSES }, deadline: { $gte: today.start, $lt: today.end } },
            empty: { title: t("Nothing due today"), description: t("A good day to get ahead on upcoming work.") },
          },
          {
            title: t("In progress"),
            description: t("Started, due later or without a deadline"),
            filter: { status: "IN_PROGRESS", $or: [{ deadline: null }, { deadline: { $gte: today.end } }] },
            hideWhenEmpty: true,
          },
        ];
      }}
    />
  );
}
