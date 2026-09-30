import type { Metadata } from "next";
import { EmployeeTaskPage } from "@/components/tasks/employee-task-page";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Completed" };

export default async function CompletedPage() {
  const t = await getT();
  return (
    <EmployeeTaskPage
      title={t("Completed")}
      description={t("Work your manager has approved.")}
      sections={() => [
        {
          title: t("Completed tasks"),
          filter: { status: "COMPLETED" },
          sort: { completedAt: -1 },
          empty: { title: t("No completed tasks yet"), description: t("Approved tasks will be listed here.") },
        },
      ]}
    />
  );
}
