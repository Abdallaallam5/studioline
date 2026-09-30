import type { Metadata } from "next";
import { TaskDetail } from "@/components/tasks/task-detail";
import { requireEmployee } from "@/server/context";

export const metadata: Metadata = { title: "Task" };

export default async function EmployeeTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireEmployee();
  const { id } = await params;
  return <TaskDetail ctx={ctx} taskId={id} backHref="/my/tasks" />;
}
