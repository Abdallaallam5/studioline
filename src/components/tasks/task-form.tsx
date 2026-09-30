import type { ReactNode } from "react";
import { FileUploader } from "@/components/files/file-uploader";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/constants";
import { toDateTimeInputValue } from "@/lib/dates";
import type { ITask } from "@/models";
import { createTask, updateTask } from "@/server/actions/tasks";
import { getT } from "@/lib/i18n/server";

interface Option {
  id: string;
  name: string;
}

interface TaskFormProps {
  projects: Option[];
  employees: Option[];
  timezone: string;
  maxUploadMb: number;
  /** Present when editing. */
  task?: ITask;
  defaultProjectId?: string;
}

async function TaskForm({ projects, employees, timezone, maxUploadMb, task, defaultProjectId }: TaskFormProps) {
  const t = await getT();
  return (
    <ActionForm action={task ? updateTask : createTask} hidden={task ? { taskId: String(task._id) } : undefined} keepValues={Boolean(task)} className="space-y-4">
      <Field label={t("Title")} name="title">
        <Input name="title" defaultValue={task?.title} required maxLength={200} autoFocus={!task} placeholder={t("e.g. Design the campaign hero banner")} />
      </Field>
      <Field label={t("Description")} name="description" optional>
        <Textarea name="description" defaultValue={task?.description ?? ""} rows={4} maxLength={10000} placeholder={t("What needs to be done, and what does “done” look like?")} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("Project")} name="projectId">
          <Select name="projectId" defaultValue={task ? String(task.projectId) : (defaultProjectId ?? "")} required>
            <option value="" disabled>
              {t("Select a project…")}
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Assign to")} name="assigneeId">
          <Select name="assigneeId" defaultValue={task ? String(task.assigneeId) : ""} required>
            <option value="" disabled>
              {t("Select a team member…")}
            </option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Deadline")} name="deadline" optional hint={t("Workspace time ({tz}).", { tz: timezone.replaceAll("_", " ") })}>
          <Input name="deadline" type="datetime-local" defaultValue={toDateTimeInputValue(task?.deadline, timezone)} />
        </Field>
        <Field label={t("Priority")} name="priority">
          <Select name="priority" defaultValue={task?.priority ?? "MEDIUM"}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(TASK_PRIORITY_LABELS[p])}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t("Checklist")} name="checklist" optional hint={t("One item per line.")}>
        <Textarea name="checklist" defaultValue={task?.checklist.map((c) => c.text).join("\n") ?? ""} rows={3} placeholder={t("Export in 3 sizes\nUse the approved palette")} />
      </Field>
      <Field label={t("Tags")} name="tags" optional hint={t("Separate with commas.")}>
        <Input name="tags" defaultValue={task?.tags.join(", ") ?? ""} placeholder={t("social, design")} />
      </Field>
      <Field label={task ? t("Add attachments") : t("Attachments")} name="fileIds" optional as="div">
        <FileUploader maxMb={maxUploadMb} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton>{task ? t("Save changes") : t("Create task")}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export async function TaskFormModal({ trigger, ...props }: TaskFormProps & { trigger: ReactNode }) {
  const t = await getT();
  const blocked = !props.task && (props.projects.length === 0 || props.employees.length === 0);
  return (
    <Modal trigger={trigger} size="lg" title={props.task ? t("Edit task") : t("New task")} description={props.task ? undefined : t("The assignee is notified and can start right away.")}>
      {blocked ? (
        <p className="py-4 text-sm leading-relaxed text-muted">
          {props.projects.length === 0 ? t("Create a project first — every task belongs to one.") : t("Invite a team member first — every task needs an assignee.")}
        </p>
      ) : (
        <TaskForm {...props} />
      )}
    </Modal>
  );
}
