"use client";

import type { ReactNode } from "react";
import {
  ACCOUNT_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type ProjectStatus,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

export type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "violet";

const tones: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-700 ring-stone-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200/70",
  amber: "bg-amber-50 text-amber-800 ring-amber-200/80",
  red: "bg-red-50 text-red-700 ring-red-200/80",
  blue: "bg-sky-50 text-sky-800 ring-sky-200/80",
  violet: "bg-violet-50 text-violet-800 ring-violet-200/80",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

const taskTones: Record<TaskStatus, Tone> = {
  NEW: "neutral",
  IN_PROGRESS: "blue",
  BLOCKED: "red",
  SUBMITTED_FOR_REVIEW: "violet",
  CHANGES_REQUESTED: "amber",
  COMPLETED: "green",
  CANCELLED: "neutral",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const t = useT();
  return (
    <Badge tone={taskTones[status]} className={status === "CANCELLED" ? "line-through opacity-70" : undefined}>
      {t(TASK_STATUS_LABELS[status])}
    </Badge>
  );
}

const priorityDots: Record<TaskPriority, string> = {
  LOW: "bg-stone-300",
  MEDIUM: "bg-sky-500",
  HIGH: "bg-amber-500",
  URGENT: "bg-red-600",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-ink-soft">
      <span className={cn("size-2 rounded-full", priorityDots[priority])} aria-hidden />
      {t(TASK_PRIORITY_LABELS[priority])}
    </span>
  );
}

const projectTones: Record<ProjectStatus, Tone> = { PLANNED: "neutral", ACTIVE: "green", COMPLETED: "blue", ARCHIVED: "neutral" };

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const t = useT();
  return <Badge tone={projectTones[status]}>{t(PROJECT_STATUS_LABELS[status])}</Badge>;
}

const accountTones: Record<keyof typeof ACCOUNT_STATUS_LABELS, Tone> = {
  PENDING_APPROVAL: "amber",
  PENDING_VERIFICATION: "blue",
  PENDING_PAYMENT: "amber",
  ACTIVE: "green",
  PAST_DUE: "amber",
  SUSPENDED: "red",
  CANCELLED: "neutral",
  REJECTED: "red",
  COMPLETED: "green",
};

export function AccountStatusBadge({ status }: { status: keyof typeof ACCOUNT_STATUS_LABELS }) {
  const t = useT();
  return <Badge tone={accountTones[status]}>{t(ACCOUNT_STATUS_LABELS[status])}</Badge>;
}

export function HelpBadge() {
  const t = useT();
  return <Badge tone="red">{t("Help requested")}</Badge>;
}
