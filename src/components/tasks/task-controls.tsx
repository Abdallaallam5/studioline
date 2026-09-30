"use client";

import { useOptimistic, useTransition } from "react";
import { Checkbox, Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/constants";
import { MANAGER_MANUAL_STATUSES } from "@/lib/tasks/workflow";
import { cn } from "@/lib/utils";
import { setTaskStatus, toggleChecklistItem } from "@/server/actions/tasks";
import { useT } from "@/lib/i18n/client";

export function ChecklistItem({ taskId, itemId, text, done, disabled }: { taskId: string; itemId: string; text: string; done: boolean; disabled?: boolean }) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [, startTransition] = useTransition();

  function onChange(next: boolean) {
    startTransition(async () => {
      setOptimisticDone(next);
      const formData = new FormData();
      formData.set("taskId", taskId);
      formData.set("itemId", itemId);
      formData.set("done", String(next));
      const result = await toggleChecklistItem(formData);
      if (!result.ok) toast.error(result.error ?? "Could not update the checklist.");
    });
  }

  return (
    <label className={cn("flex items-start gap-2.5 rounded-md px-1 py-1.5 text-sm", !disabled && "cursor-pointer hover:bg-paper")}>
      <Checkbox checked={optimisticDone} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
      <span className={cn("leading-snug", optimisticDone && "text-muted line-through")}>{text}</span>
    </label>
  );
}

/** Manager-only manual status override. Review outcomes are not offered here. */
export function StatusSelect({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const options = MANAGER_MANUAL_STATUSES.includes(status) ? MANAGER_MANUAL_STATUSES : [status, ...MANAGER_MANUAL_STATUSES];

  function onChange(next: string) {
    if (next === "CANCELLED" && !window.confirm("Cancel this task? The assignee will be notified.")) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("taskId", taskId);
      formData.set("status", next);
      const result = await setTaskStatus(formData);
      if (result.ok) {
        if (result.message) toast.success(result.message);
      } else {
        toast.error(result.error ?? "Could not change the status.");
      }
    });
  }

  return (
    <Select value={status} disabled={pending} onChange={(e) => onChange(e.target.value)} aria-label={t("Change status")} className="w-auto min-w-40">
      {options.map((s) => (
        <option key={s} value={s} disabled={!MANAGER_MANUAL_STATUSES.includes(s)}>
          {t(TASK_STATUS_LABELS[s])}
        </option>
      ))}
    </Select>
  );
}
