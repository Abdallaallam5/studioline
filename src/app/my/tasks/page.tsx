import type { Metadata } from "next";
import { EmployeeTaskPage } from "@/components/tasks/employee-task-page";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "My tasks" };

export default async function MyTasksPage() {
  const t = await getT();
  return (
    <EmployeeTaskPage
      title={t("My tasks")}
      description={t("Everything assigned to you that isn't finished yet.")}
      sections={() => [
        { title: t("Changes requested"), description: t("Your manager asked for updates"), filter: { status: "CHANGES_REQUESTED" }, hideWhenEmpty: true },
        { title: t("In progress"), filter: { status: "IN_PROGRESS" }, empty: { title: t("Nothing in progress"), description: t("Start a task from “To do” below.") } },
        { title: t("To do"), description: t("Not started yet"), filter: { status: "NEW" }, empty: { title: t("No new tasks") } },
        { title: t("Blocked"), filter: { status: "BLOCKED" }, hideWhenEmpty: true },
        { title: t("Waiting for review"), filter: { status: "SUBMITTED_FOR_REVIEW" }, hideWhenEmpty: true },
      ]}
    />
  );
}
