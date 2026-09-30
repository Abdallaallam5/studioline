"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { isValidTimezone } from "@/lib/dates";
import type { ActionState } from "@/lib/utils";
import { Notification, Workspace } from "@/models";
import { parseForm, requireManagerWrite, run, zId } from "../action-utils";

/* ─── Workspace settings (manager) ───────────────────────────────────── */

const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Enter a workspace name").max(160),
  timezone: z.string().refine(isValidTimezone, "Select a valid timezone"),
});

export async function updateWorkspace(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireManagerWrite();
    const data = parseForm(workspaceSchema, formData);
    await Workspace.updateOne({ _id: ctx.workspace.id, managerId: ctx.user.id }, { $set: data });
    revalidatePath("/workspace", "layout");
    return { ok: true, message: "Workspace settings saved." };
  });
}

/* ─── Notifications (any signed-in user; always scoped to themselves) ── */

export async function markNotificationRead(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    const { notificationId } = parseForm(z.object({ notificationId: zId }), formData);
    await Notification.updateOne({ _id: notificationId, userId: user.id, readAt: null }, { $set: { readAt: new Date() } });
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

export async function markAllNotificationsRead(): Promise<ActionState> {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    await Notification.updateMany({ userId: user.id, readAt: null }, { $set: { readAt: new Date() } });
    revalidatePath("/", "layout");
    return { ok: true, message: "All caught up." };
  });
}
