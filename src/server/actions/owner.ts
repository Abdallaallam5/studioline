"use server";

import { msg } from "@/lib/i18n/config";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateToken } from "@/lib/auth/crypto";
import { PAYMENT_METHODS } from "@/lib/constants";
import { parseLocalDate } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { emailTemplates } from "@/lib/email/templates";
import { appUrl } from "@/lib/env";
import { translatorFor } from "@/lib/i18n/server";
import { whatsappLink } from "@/lib/whatsapp";
import { BRAND } from "@/lib/brand";
import { formatMoney, parseMoneyToCents, type ActionState, type ShareLink } from "@/lib/utils";
import { AuthToken, Payment, PlatformSettings, RegistrationRequest, Session, Subscription, User, Workspace, type IRegistrationRequest, type IWorkspace } from "@/models";
import { ActionError, parseForm, run, zId, zOptionalText } from "../action-utils";
import { logPlatform } from "../activity";
import { requireOwner } from "../context";
import { createResetLinkFor } from "../reset-link";
import { getPlatformSettings, syncWorkspaceStatus } from "../subscription";

const SETUP_TTL_DAYS = 7;

/** Billing dates are calendar dates; they are stored as UTC midnight. */
const zDate = z.string().transform((v, ctx) => {
  const d = parseLocalDate(v, "UTC");
  if (!d) {
    ctx.addIssue({ code: "custom", message: "Enter a valid date" });
    return z.NEVER;
  }
  return d;
});

const zMoney = z.string().transform((v, ctx) => {
  const cents = parseMoneyToCents(v);
  if (cents === null) {
    ctx.addIssue({ code: "custom", message: "Enter a valid amount, e.g. 49 or 49.50" });
    return z.NEVER;
  }
  return cents;
});

function refresh() {
  revalidatePath("/owner", "layout");
}

async function findWorkspace(workspaceId: string): Promise<IWorkspace> {
  const workspace = await Workspace.findById(workspaceId).lean();
  if (!workspace) throw new ActionError("Workspace not found.");
  return workspace;
}

/* ─── Registration requests ──────────────────────────────────────────── */

/** Create a fresh single-use setup link, email it, and return it so the owner can also pass it on directly. */
async function issueSetupLink(request: Pick<IRegistrationRequest, "_id" | "fullName" | "email" | "phone" | "locale">): Promise<{ emailed: boolean; share: ShareLink }> {
  await AuthToken.deleteMany({ requestId: request._id, type: "SETUP" });
  const { raw, hash } = generateToken();
  await AuthToken.create({ type: "SETUP", tokenHash: hash, requestId: request._id, expiresAt: new Date(Date.now() + SETUP_TTL_DAYS * 86_400_000) });
  const url = appUrl(`/setup/${raw}`);
  const emailed = await sendEmail({
    to: request.email,
    ...emailTemplates.requestApproved(request.locale, { name: request.fullName, setupUrl: url, expiresInDays: SETUP_TTL_DAYS }),
  });
  // The WhatsApp message is written in the applicant's language.
  const t = translatorFor(request.locale);
  const text = t("Hi {name}, your {brand} workspace request was approved. Set up your account here:\n{url}", { name: request.fullName.split(" ")[0], brand: BRAND.name, url });
  return { emailed, share: { url, whatsapp: whatsappLink(request.phone, text) } };
}

export async function approveRequest(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { user, actor } = await requireOwner();
    const { requestId } = parseForm(z.object({ requestId: zId }), formData);

    const pending = await RegistrationRequest.findOne({ _id: requestId, status: "PENDING_APPROVAL" }).lean();
    if (!pending) throw new ActionError("This request has already been reviewed.");
    if (await User.exists({ email: pending.email })) throw new ActionError("An account with this email already exists.");

    const request = await RegistrationRequest.findOneAndUpdate(
      { _id: requestId, status: "PENDING_APPROVAL" },
      { $set: { status: "PENDING_VERIFICATION", reviewedBy: user.id, reviewedAt: new Date() } },
      { returnDocument: "after" },
    ).lean();
    if (!request) throw new ActionError("This request has already been reviewed.");

    const { emailed, share } = await issueSetupLink(request);
    await logPlatform("MANAGER_APPROVED", msg("{name} ({company}) was approved", { name: request.fullName, company: request.company }), actor);
    refresh();
    return {
      ok: true,
      share,
      message: emailed
        ? msg("Approved. A setup link was emailed to {email}.", { email: request.email })
        : msg("Approved. Share the setup link below with {name}.", { name: request.fullName }),
    };
  });
}

export async function resendSetupLink(formData: FormData): Promise<ActionState> {
  return run(async () => {
    await requireOwner();
    const { requestId } = parseForm(z.object({ requestId: zId }), formData);
    const request = await RegistrationRequest.findOne({ _id: requestId, status: "PENDING_VERIFICATION" }).lean();
    if (!request) throw new ActionError("This request is not waiting for verification.");
    const { emailed, share } = await issueSetupLink(request);
    return {
      ok: true,
      share,
      message: emailed
        ? msg("A new setup link was emailed to {email}.", { email: request.email })
        : msg("New setup link ready. Share it with {name}.", { name: request.fullName }),
    };
  });
}

export async function rejectRequest(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { user, actor } = await requireOwner();
    const data = parseForm(z.object({ requestId: zId, reason: zOptionalText(1000) }), formData);
    const request = await RegistrationRequest.findOneAndUpdate(
      { _id: data.requestId, status: "PENDING_APPROVAL" },
      { $set: { status: "REJECTED", reviewedBy: user.id, reviewedAt: new Date(), rejectionReason: data.reason } },
      { returnDocument: "after" },
    ).lean();
    if (!request) throw new ActionError("This request has already been reviewed.");

    await sendEmail({ to: request.email, ...emailTemplates.requestRejected(request.locale, { name: request.fullName, reason: data.reason }) });
    await logPlatform("MANAGER_REJECTED", msg("{name} ({company}) was rejected", { name: request.fullName, company: request.company }), actor);
    refresh();
    return { ok: true, message: "Request rejected." };
  });
}

/* ─── Subscriptions ──────────────────────────────────────────────────── */

const activateSchema = z
  .object({
    workspaceId: zId,
    amount: zMoney,
    startDate: zDate,
    renewalDate: zDate,
    notes: zOptionalText(2000),
    recordPayment: z.string().optional(),
    paidAt: z.string().optional(),
    method: z.enum(PAYMENT_METHODS).optional(),
    reference: zOptionalText(200),
  })
  .refine((d) => d.renewalDate > d.startDate, { path: ["renewalDate"], message: "Renewal must be after the start date" });

export async function activateSubscription(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { user, actor } = await requireOwner();
    const data = parseForm(activateSchema, formData);
    const workspace = await findWorkspace(data.workspaceId);
    const settings = await getPlatformSettings();

    const wantsPayment = data.recordPayment === "on";
    const paidAt = wantsPayment ? parseLocalDate(data.paidAt ?? "", "UTC") : null;
    if (wantsPayment && (!paidAt || !data.method)) {
      return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { paidAt: ["Enter the payment date and method"] } };
    }

    const subscription = await Subscription.findOneAndUpdate(
      { workspaceId: workspace._id },
      {
        $set: { amountCents: data.amount, startDate: data.startDate, renewalDate: data.renewalDate, activatedAt: new Date(), cancelledAt: null, notes: data.notes, reminderSentFor: null },
      },
      { upsert: true, returnDocument: "after" },
    ).lean();
    if (!subscription) throw new ActionError("Could not save the subscription.");

    if (wantsPayment && paidAt && data.method) {
      await Payment.create({
        workspaceId: workspace._id,
        subscriptionId: subscription._id,
        amountCents: data.amount,
        paidAt,
        method: data.method,
        reference: data.reference,
        periodStart: data.startDate,
        periodEnd: data.renewalDate,
        recordedBy: user.id,
      });
      await logPlatform("PAYMENT_RECORDED", msg("{amount} recorded for {workspace}", { amount: formatMoney(data.amount, settings.currency), workspace: workspace.name }), actor, String(workspace._id), { amountCents: data.amount });
    }

    await logPlatform(
      "SUBSCRIPTION_ACTIVATED",
      msg("Subscription activated for {workspace} at {amount}/month", { workspace: workspace.name, amount: formatMoney(data.amount, settings.currency) }),
      actor,
      String(workspace._id),
    );
    await syncWorkspaceStatus(String(workspace._id), { actor });

    const manager = await User.findById(workspace.managerId).lean();
    if (manager) {
      await sendEmail({
        to: manager.email,
        ...emailTemplates.subscriptionActivated(manager.locale, { name: manager.name, workspaceName: workspace.name, renewalDate: data.renewalDate, appUrl: appUrl("/workspace") }),
      });
    }
    refresh();
    return { ok: true, message: "Subscription activated." };
  });
}

const updateSubscriptionSchema = z.object({ workspaceId: zId, amount: zMoney, renewalDate: zDate, notes: zOptionalText(2000) });

export async function updateSubscription(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { actor } = await requireOwner();
    const data = parseForm(updateSubscriptionSchema, formData);
    const workspace = await findWorkspace(data.workspaceId);
    const result = await Subscription.updateOne(
      { workspaceId: workspace._id },
      { $set: { amountCents: data.amount, renewalDate: data.renewalDate, notes: data.notes } },
    );
    if (result.matchedCount === 0) throw new ActionError("This workspace has no subscription yet. Activate one first.");

    const { currency } = await getPlatformSettings();
    await logPlatform(
      "SUBSCRIPTION_UPDATED",
      msg("Subscription for {workspace} set to {amount}/month, renewing {d_date}", { workspace: workspace.name, amount: formatMoney(data.amount, currency), d_date: data.renewalDate.toISOString() }),
      actor,
      String(workspace._id),
    );
    await syncWorkspaceStatus(String(workspace._id), { actor });
    refresh();
    return { ok: true, message: "Subscription updated." };
  });
}

export async function cancelSubscription(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { actor } = await requireOwner();
    const { workspaceId } = parseForm(z.object({ workspaceId: zId }), formData);
    const workspace = await findWorkspace(workspaceId);
    const result = await Subscription.updateOne({ workspaceId: workspace._id, cancelledAt: null }, { $set: { cancelledAt: new Date() } });
    if (result.matchedCount === 0) throw new ActionError("There is no active subscription to cancel.");
    await logPlatform("SUBSCRIPTION_CANCELLED", msg("Subscription for {workspace} was cancelled", { workspace: workspace.name }), actor, workspaceId);
    await syncWorkspaceStatus(workspaceId, { actor });
    refresh();
    return { ok: true, message: "Subscription cancelled. Workspace data is preserved." };
  });
}

/* ─── Payments ───────────────────────────────────────────────────────── */

const paymentSchema = z
  .object({
    workspaceId: zId,
    amount: zMoney,
    paidAt: zDate,
    method: z.enum(PAYMENT_METHODS, "Select a payment method"),
    reference: zOptionalText(200),
    note: zOptionalText(1000),
    periodStart: zDate,
    periodEnd: zDate,
  })
  .refine((d) => d.periodEnd > d.periodStart, { path: ["periodEnd"], message: "Period end must be after its start" });

export async function recordPayment(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { user, actor } = await requireOwner();
    const data = parseForm(paymentSchema, formData);
    const workspace = await findWorkspace(data.workspaceId);
    const subscription = await Subscription.findOne({ workspaceId: workspace._id }).lean();
    if (!subscription) throw new ActionError("Activate a subscription for this workspace before recording payments.");

    await Payment.create({
      workspaceId: workspace._id,
      subscriptionId: subscription._id,
      amountCents: data.amount,
      paidAt: data.paidAt,
      method: data.method,
      reference: data.reference,
      note: data.note,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      recordedBy: user.id,
    });

    // A payment extends the paid-through date; it never shortens it.
    const renewalDate = data.periodEnd > subscription.renewalDate ? data.periodEnd : subscription.renewalDate;
    await Subscription.updateOne({ _id: subscription._id }, { $set: { renewalDate } });

    const { currency } = await getPlatformSettings();
    const amount = formatMoney(data.amount, currency);
    await logPlatform("PAYMENT_RECORDED", msg("{amount} recorded for {workspace}", { amount, workspace: workspace.name }), actor, String(workspace._id), { amountCents: data.amount });
    await syncWorkspaceStatus(String(workspace._id), { actor });

    const manager = await User.findById(workspace.managerId).lean();
    if (manager) {
      await sendEmail({
        to: manager.email,
        ...emailTemplates.paymentRecorded(manager.locale, { name: manager.name, amount, paidAt: data.paidAt, renewalDate }),
      });
    }
    refresh();
    return { ok: true, message: msg("Payment recorded. Subscription runs until {d_date}.", { d_date: renewalDate.toISOString() }) };
  });
}

export async function voidPayment(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { actor } = await requireOwner();
    const data = parseForm(z.object({ paymentId: zId, reason: z.string().trim().min(3, "Give a short reason").max(500) }), formData);
    const payment = await Payment.findOneAndUpdate(
      { _id: data.paymentId, voidedAt: null },
      { $set: { voidedAt: new Date(), voidReason: data.reason } },
      { returnDocument: "after" },
    ).lean();
    if (!payment) throw new ActionError("Payment not found or already voided.");

    const workspace = await Workspace.findById(payment.workspaceId).lean();
    const { currency } = await getPlatformSettings();
    await logPlatform(
      "PAYMENT_VOIDED",
      msg("{amount} payment for {workspace} was voided: {reason}", { amount: formatMoney(payment.amountCents, currency), workspace: workspace?.name ?? "—", reason: data.reason }),
      actor,
      String(payment.workspaceId),
    );
    refresh();
    return { ok: true, message: "Payment voided. Adjust the renewal date under “Edit subscription” if it needs to move back." };
  });
}

/* ─── Account controls ───────────────────────────────────────────────── */

export async function suspendWorkspace(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { actor } = await requireOwner();
    const data = parseForm(z.object({ workspaceId: zId, reason: zOptionalText(500) }), formData);
    const workspace = await findWorkspace(data.workspaceId);
    await Workspace.updateOne({ _id: workspace._id }, { $set: { manualSuspendedAt: new Date(), manualSuspendReason: data.reason } });
    await logPlatform("ACCOUNT_SUSPENDED", data.reason ? msg("{workspace} was suspended: {reason}", { workspace: workspace.name, reason: data.reason }) : msg("{workspace} was suspended", { workspace: workspace.name }), actor, data.workspaceId);
    await syncWorkspaceStatus(data.workspaceId, { actor });
    refresh();
    return { ok: true, message: "Workspace suspended." };
  });
}

export async function reinstateWorkspace(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { actor } = await requireOwner();
    const { workspaceId } = parseForm(z.object({ workspaceId: zId }), formData);
    const workspace = await findWorkspace(workspaceId);
    await Workspace.updateOne({ _id: workspace._id }, { $set: { manualSuspendedAt: null, manualSuspendReason: null } });
    await logPlatform("ACCOUNT_REINSTATED", msg("Manual suspension lifted for {workspace}", { workspace: workspace.name }), actor, workspaceId);
    const updated = await syncWorkspaceStatus(workspaceId, { actor });
    refresh();
    return updated?.accountStatus === "SUSPENDED"
      ? { ok: true, message: "Manual suspension lifted, but the subscription is still overdue. Record a payment to restore access." }
      : { ok: true, message: "Workspace reinstated." };
  });
}

export async function setWorkspaceDisabled(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { actor } = await requireOwner();
    const data = parseForm(z.object({ workspaceId: zId, disabled: z.enum(["true", "false"]) }), formData);
    const workspace = await findWorkspace(data.workspaceId);
    const disabled = data.disabled === "true";

    await Workspace.updateOne({ _id: workspace._id }, { $set: { disabledAt: disabled ? new Date() : null } });
    if (disabled) {
      // Sign every member out immediately.
      const members = await User.find({ workspaceId: workspace._id }).select("_id").lean();
      await Session.deleteMany({ userId: { $in: members.map((m) => m._id) } });
    }
    await logPlatform(disabled ? "ACCOUNT_DISABLED" : "ACCOUNT_ENABLED", msg(disabled ? "{workspace} was disabled" : "{workspace} was re-enabled", { workspace: workspace.name }), actor, data.workspaceId);
    refresh();
    return { ok: true, message: disabled ? "Account disabled. Nobody in this workspace can sign in." : "Account re-enabled." };
  });
}

/** Owner hands a Project Manager a password-reset link directly (no email needed). */
export async function createManagerResetLink(formData: FormData): Promise<ActionState> {
  return run(async () => {
    await requireOwner();
    const { workspaceId } = parseForm(z.object({ workspaceId: zId }), formData);
    const workspace = await findWorkspace(workspaceId);
    const manager = await User.findOne({ _id: workspace.managerId, role: "MANAGER" }).lean();
    if (!manager) throw new ActionError("Workspace not found.");
    const share = await createResetLinkFor(manager);
    return { ok: true, share, message: msg("Password reset link for {name}. It works once and expires in 24 hours.", { name: manager.name }) };
  });
}

/* ─── Platform settings ──────────────────────────────────────────────── */

const settingsSchema = z.object({
  gracePeriodDays: z.coerce.number().int("Use a whole number").min(0).max(90),
  renewalSoonDays: z.coerce.number().int("Use a whole number").min(1).max(60),
  defaultPrice: zMoney,
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD"),
});

export async function updatePlatformSettings(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { actor } = await requireOwner();
    const data = parseForm(settingsSchema, formData);
    await PlatformSettings.findOneAndUpdate(
      { key: "platform" },
      { $set: { gracePeriodDays: data.gracePeriodDays, renewalSoonDays: data.renewalSoonDays, defaultPriceCents: data.defaultPrice, currency: data.currency } },
      { upsert: true },
    );
    await logPlatform("SETTINGS_UPDATED", msg("Grace period set to {count} days", { count: data.gracePeriodDays }), actor);

    // Apply the new grace period to every billable workspace right away.
    const settings = { gracePeriodDays: data.gracePeriodDays, renewalSoonDays: data.renewalSoonDays, defaultPriceCents: data.defaultPrice, currency: data.currency };
    const subscriptions = await Subscription.find().select("workspaceId").lean();
    for (const s of subscriptions) await syncWorkspaceStatus(String(s.workspaceId), { settings });

    refresh();
    return { ok: true, message: "Settings saved." };
  });
}
