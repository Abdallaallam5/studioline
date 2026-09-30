import type { ReactNode } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PROJECT_COLORS, PROJECT_STATUS_LABELS, PROJECT_STATUSES } from "@/lib/constants";
import { toDateInputValue } from "@/lib/dates";
import type { IProject } from "@/models";
import { createProject, updateProject } from "@/server/actions/projects";
import { getT } from "@/lib/i18n/server";

interface Props {
  trigger: ReactNode;
  employees: { id: string; name: string }[];
  timezone: string;
  /** Present when editing. */
  project?: IProject;
}

export async function ProjectFormModal({ trigger, employees, timezone, project }: Props) {
  const t = await getT();
  const memberIds = new Set(project?.memberIds.map(String));
  return (
    <Modal trigger={trigger} size="lg" title={project ? t("Edit project") : t("New project")}>
      <ActionForm action={project ? updateProject : createProject} hidden={project ? { projectId: String(project._id) } : undefined} keepValues={Boolean(project)} className="space-y-4">
        <Field label={t("Project name")} name="name">
          <Input name="name" defaultValue={project?.name} required maxLength={160} autoFocus={!project} placeholder={t("e.g. Spring product launch")} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("Client")} name="clientName" optional>
            <Input name="clientName" defaultValue={project?.clientName ?? ""} maxLength={160} />
          </Field>
          <Field label={t("Status")} name="status">
            <Select name="status" defaultValue={project?.status ?? "ACTIVE"}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(PROJECT_STATUS_LABELS[s])}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("Start date")} name="startDate" optional>
            <Input name="startDate" type="date" defaultValue={toDateInputValue(project?.startDate, timezone)} />
          </Field>
          <Field label={t("End date")} name="endDate" optional>
            <Input name="endDate" type="date" defaultValue={toDateInputValue(project?.endDate, timezone)} />
          </Field>
        </div>
        <Field label={t("Description")} name="description" optional>
          <Textarea name="description" defaultValue={project?.description ?? ""} rows={3} maxLength={5000} />
        </Field>

        <Field label={t("Colour")} name="color" as="div">
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((color, i) => (
              <label key={color} className="cursor-pointer">
                <input type="radio" name="color" value={color} defaultChecked={project ? project.color === color : i === 0} className="peer sr-only" />
                <span
                  className="block size-7 rounded-full ring-offset-2 ring-offset-surface transition-shadow peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-brand"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              </label>
            ))}
          </div>
        </Field>

        <Field label={t("Team members")} name="memberIds" as="div" optional hint={t("People you assign tasks to are added automatically.")}>
          {employees.length === 0 ? (
            <p className="text-[13px] text-muted">{t("No team members yet. You can add them later.")}</p>
          ) : (
            <div className="grid max-h-44 gap-1 overflow-y-auto rounded-lg border border-line p-2 sm:grid-cols-2">
              {employees.map((e) => (
                <label key={e.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-paper">
                  <Checkbox name="memberIds[]" value={e.id} defaultChecked={memberIds.has(e.id)} />
                  <span className="truncate">{e.name}</span>
                </label>
              ))}
            </div>
          )}
        </Field>

        <div className="flex justify-end">
          <SubmitButton>{project ? t("Save changes") : t("Create project")}</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}
