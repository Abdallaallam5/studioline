"use server";

import { msg } from "@/lib/i18n/config";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PROJECT_COLORS, PROJECT_STATUS_LABELS, PROJECT_STATUSES } from "@/lib/constants";
import { parseLocalDate } from "@/lib/dates";
import type { ActionState } from "@/lib/utils";
import { Project, User } from "@/models";
import { ActionError, go, parseForm, requireManagerWrite, run, zId, zIdList, zOptionalText } from "../action-utils";
import { logWorkspace } from "../activity";
import type { WorkspaceContext } from "../context";
import { scope } from "../tenant";

const projectSchema = z.object({
  name: z.string().trim().min(2, "Enter a project name").max(160),
  description: zOptionalText(5000),
  clientName: zOptionalText(160),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(PROJECT_STATUSES),
  memberIds: zIdList,
  color: z.enum(PROJECT_COLORS),
});

async function toProjectFields(ctx: WorkspaceContext, data: z.infer<typeof projectSchema>) {
  const tz = ctx.workspace.timezone;
  const startDate = data.startDate ? parseLocalDate(data.startDate, tz) : null;
  const endDate = data.endDate ? parseLocalDate(data.endDate, tz) : null;
  if (startDate && endDate && endDate < startDate) {
    throw new z.ZodError([{ code: "custom", path: ["endDate"], message: "End date must be after the start date", input: data.endDate }]);
  }

  // Members must be employees of this workspace — ids from elsewhere are dropped.
  const members = await User.find({ _id: { $in: data.memberIds }, ...scope(ctx), role: "EMPLOYEE" }).select("_id").lean();
  if (members.length !== new Set(data.memberIds).size) throw new ActionError("One or more selected team members are not part of this workspace.");

  return {
    name: data.name,
    description: data.description,
    clientName: data.clientName,
    startDate,
    endDate,
    status: data.status,
    memberIds: members.map((m) => m._id),
    color: data.color,
  };
}

export async function createProject(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireManagerWrite();
    const fields = await toProjectFields(ctx, parseForm(projectSchema, formData));
    const project = await Project.create({ ...fields, ...scope(ctx), createdBy: ctx.user.id });
    await logWorkspace(ctx.workspace.id, "PROJECT_CREATED", msg('Created project "{name}"', { name: project.name }), ctx.actor, { projectId: String(project._id) });
    revalidatePath("/workspace", "layout");
    go(`/workspace/projects/${project._id}`);
  });
}

export async function updateProject(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireManagerWrite();
    const { projectId } = parseForm(z.object({ projectId: zId }), formData);
    const fields = await toProjectFields(ctx, parseForm(projectSchema, formData));

    const previous = await Project.findOneAndUpdate({ _id: projectId, ...scope(ctx) }, { $set: fields }).lean();
    if (!previous) throw new ActionError("Project not found.");

    const summary = previous.status !== fields.status ? msg('Moved project "{name}" to {t_status}', { name: fields.name, t_status: PROJECT_STATUS_LABELS[fields.status] }) : msg('Updated project "{name}"', { name: fields.name });
    await logWorkspace(ctx.workspace.id, "PROJECT_UPDATED", summary, ctx.actor, { projectId });
    revalidatePath("/workspace", "layout");
    return { ok: true, message: "Project saved." };
  });
}
