import type { Metadata } from "next";
import { TaskDetail } from "@/components/tasks/task-detail";
import { requireManager } from "@/server/context";

export const metadata: Metadata = { title: "Task" };

export default async function ManagerTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireManager();
  const { id } = await params;
  return <TaskDetail ctx={ctx} taskId={id} backHref="/workspace/tasks" />;
}
