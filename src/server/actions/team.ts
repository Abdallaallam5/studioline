"use server";

import { msg } from "@/lib/i18n/config";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateToken } from "@/lib/auth/crypto";
import { destroyAllSessions } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email";
import { emailTemplates } from "@/lib/email/templates";
import { appUrl } from "@/lib/env";
import { getLocale, getT } from "@/lib/i18n/server";
import { whatsappLink } from "@/lib/whatsapp";
import { BRAND } from "@/lib/brand";
import type { ActionState, ShareLink } from "@/lib/utils";
import { Invitation, User } from "@/models";
import { ActionError, parseForm, requireManagerWrite, run, zEmail, zId, zName, zOptionalPhone, zOptionalText } from "../action-utils";
import { logPlatform, logWorkspace, SYSTEM_ACTOR } from "../activity";
import type { WorkspaceContext } from "../context";
import { createResetLinkFor } from "../reset-link";
import { scope } from "../tenant";

const INVITE_TTL_DAYS = 7;

function refresh() {
  revalidatePath("/workspace", "layout");
}

/** Email the invitation and return the link so the manager can also send it directly (e.g. on WhatsApp). */
async function sendInvite(ctx: WorkspaceContext, invitation: { name: string; email: string; phone?: string | null }, rawToken: string): Promise<{ emailed: boolean; share: ShareLink }> {
  const url = appUrl(`/invite/${rawToken}`);
  const t = await getT();
  const text = t("Hi {name}, {manager} invited you to join {workspace} on {brand}. Accept the invitation here:\n{url}", {
    name: invitation.name.split(" ")[0],
    manager: ctx.user.name,
    workspace: ctx.workspace.name,
    brand: BRAND.name,
    url,
  });
  const emailed = await sendEmail({
    to: invitation.email,
    // The invitee has no saved language yet, so the email follows the manager's.
    ...emailTemplates.invitation(await getLocale(), {
      name: invitation.name,
      managerName: ctx.user.name,
      workspaceName: ctx.workspace.name,
      inviteUrl: url,
      expiresInDays: INVITE_TTL_DAYS,
    }),
  });
  return { emailed, share: { url, whatsapp: whatsappLink(invitation.phone, text) } };
}

/** The owner sees head-count changes only, never who joined or left. */
async function logEmployeeCount(ctx: WorkspaceContext) {
  const count = await User.countDocuments({ ...scope(ctx), role: "EMPLOYEE", disabledAt: null });
  await logPlatform("EMPLOYEE_COUNT_CHANGED", msg("{workspace} now has {count} employees", { workspace: ctx.workspace.name, count }), SYSTEM_ACTOR, ctx.workspace.id, { employeeCount: count });
}

const inviteSchema = z.object({ name: zName, email: zEmail, phone: zOptionalPhone, jobTitle: zOptionalText(120) });

export async function inviteEmployee(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireManagerWrite();
    const data = parseForm(inviteSchema, formData);

    // One account per email across the platform.
    if (await User.exists({ email: data.email })) {
      return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { email: ["This email already has an account"] } };
    }
    const pending = await Invitation.exists({ ...scope(ctx), email: data.email, acceptedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } });
    if (pending) {
      return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { email: ["An invitation is already pending for this email"] } };
    }

    const { raw, hash } = generateToken();
    await Invitation.create({
      ...scope(ctx),
      email: data.email,
      name: data.name,
      phone: data.phone,
      jobTitle: data.jobTitle,
      tokenHash: hash,
      invitedBy: ctx.user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
    });
    const { emailed, share } = await sendInvite(ctx, data, raw);
    await logWorkspace(ctx.workspace.id, "EMPLOYEE_INVITED", msg("Invited {name} to the team", { name: data.name }), ctx.actor);
    refresh();
    return {
      ok: true,
      share,
      message: emailed ? msg("Invitation sent to {email}.", { email: data.email }) : msg("Invitation created. Share the link below with {name}.", { name: data.name }),
    };
  });
}

export async function resendInvitation(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireManagerWrite();
    const { invitationId } = parseForm(z.object({ invitationId: zId }), formData);
    // A fresh token replaces the old one, which stops working.
    const { raw, hash } = generateToken();
    const invitation = await Invitation.findOneAndUpdate(
      { _id: invitationId, ...scope(ctx), acceptedAt: null, revokedAt: null },
      { $set: { tokenHash: hash, expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000) } },
      { returnDocument: "after" },
    ).lean();
    if (!invitation) throw new ActionError("Invitation not found.");
    const { emailed, share } = await sendInvite(ctx, invitation, raw);
    refresh();
    return {
      ok: true,
      share,
      message: emailed ? msg("Invitation re-sent to {email}.", { email: invitation.email }) : msg("New invitation link ready. Share it with {name}.", { name: invitation.name }),
    };
  });
}

export async function revokeInvitation(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireManagerWrite();
    const { invitationId } = parseForm(z.object({ invitationId: zId }), formData);
    const result = await Invitation.updateOne({ _id: invitationId, ...scope(ctx), acceptedAt: null, revokedAt: null }, { $set: { revokedAt: new Date() } });
    if (result.matchedCount === 0) throw new ActionError("Invitation not found.");
    refresh();
    return { ok: true, message: "Invitation revoked." };
  });
}

/** Manager hands an employee a password-reset link directly (no email needed). */
export async function createEmployeeResetLink(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireManagerWrite();
    const { employeeId } = parseForm(z.object({ employeeId: zId }), formData);
    const employee = await User.findOne({ _id: employeeId, ...scope(ctx), role: "EMPLOYEE", disabledAt: null }).lean();
    if (!employee) throw new ActionError("Team member not found.");
    const share = await createResetLinkFor(employee);
    return { ok: true, share, message: msg("Password reset link for {name}. It works once and expires in 24 hours.", { name: employee.name }) };
  });
}

const employeeSchema = z.object({ employeeId: zId, name: zName, phone: zOptionalPhone, jobTitle: zOptionalText(120) });

export async function updateEmployee(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = await requireManagerWrite();
    const data = parseForm(employeeSchema, formData);
    const result = await User.updateOne(
      { _id: data.employeeId, ...scope(ctx), role: "EMPLOYEE" },
      { $set: { name: data.name, phone: data.phone, jobTitle: data.jobTitle } },
    );
    if (result.matchedCount === 0) throw new ActionError("Team member not found.");
    refresh();
    return { ok: true, message: "Team member updated." };
  });
}

export async function setEmployeeDisabled(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const data = parseForm(z.object({ employeeId: zId, disabled: z.enum(["true", "false"]) }), formData);
    const disabled = data.disabled === "true";
    const ctx = await requireManagerWrite();

    const employee = await User.findOneAndUpdate(
      { _id: data.employeeId, ...scope(ctx), role: "EMPLOYEE" },
      { $set: { disabledAt: disabled ? new Date() : null } },
    ).lean();
    if (!employee) throw new ActionError("Team member not found.");
    if (disabled) await destroyAllSessions(String(employee._id));

    await logWorkspace(ctx.workspace.id, disabled ? "EMPLOYEE_DEACTIVATED" : "EMPLOYEE_REACTIVATED", msg(disabled ? "Deactivated {name}" : "Reactivated {name}", { name: employee.name }), ctx.actor);
    await logEmployeeCount(ctx);
    refresh();
    return { ok: true, message: msg(disabled ? "{name} can no longer sign in. Their tasks are kept." : "{name} can sign in again.", { name: employee.name }) };
  });
}
