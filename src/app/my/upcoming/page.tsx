import type { Metadata } from "next";
import { EmployeeTaskPage } from "@/components/tasks/employee-task-page";
import { OPEN_TASK_STATUSES } from "@/lib/constants";
import { addDays, dayRange } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Upcoming" };

export default async function UpcomingPage() {
  const t = await getT();
  return (
    <EmployeeTaskPage
      title={t("Upcoming")}
      description={t("Deadlines after today, soonest first.")}
      sections={(now, tz) => {
        const tomorrow = dayRange(tz, now, 1).start;
        const nextWeek = addDays(tomorrow, 7);
        return [
          { title: t("Next 7 days"), filter: { status: { $in: OPEN_TASK_STATUSES }, deadline: { $gte: tomorrow, $lt: nextWeek } }, empty: { title: t("Nothing due in the next week") } },
          { title: t("Later"), filter: { status: { $in: OPEN_TASK_STATUSES }, deadline: { $gte: nextWeek } }, hideWhenEmpty: true },
          { title: t("No deadline"), filter: { status: { $in: OPEN_TASK_STATUSES }, deadline: null }, hideWhenEmpty: true },
        ];
      }}
    />
  );
}
