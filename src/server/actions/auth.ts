"use server";

import { msg } from "@/lib/i18n/config";
import { Types } from "mongoose";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { burnPasswordCheck, generateToken, hashPassword, hashToken, verifyPassword } from "@/lib/auth/crypto";
import { clientIp, createSession, destroyAllSessions, destroyCurrentSession, getCurrentUser } from "@/lib/auth/session";
import { HOME_BY_ROLE, TEAM_SIZES } from "@/lib/constants";
import { isValidTimezone } from "@/lib/dates";
import { connectDb } from "@/lib/db";
import { queueEmail } from "@/lib/email";
import { emailTemplates } from "@/lib/email/templates";
import { appUrl } from "@/lib/env";
import { getLocale } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionState } from "@/lib/utils";
import { AuthToken, Invitation, RegistrationRequest, User, Workspace } from "@/models";
import { ActionError, go, parseForm, run, zEmail, zName, zOptionalPhone, zOptionalText, zPassword, zPhone } from "../action-utils";
import { logPlatform, logWorkspace } from "../activity";
import { notify } from "../notifications";

const RESET_TTL_MINUTES = 60;
const GENERIC_LOGIN_ERROR = "Incorrect email or password.";

/* ─── Request access (Project Manager registration) ──────────────────── */

const requestAccessSchema = z.object({
  fullName: zName,
  email: zEmail,
  phone: zPhone,
  company: z.string().trim().min(2, "Enter your company or agency name").max(160),
  teamSize: z.enum(TEAM_SIZES, "Select a team size"),
  description: zOptionalText(2000),
});

export async function requestAccess(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const data = parseForm(requestAccessSchema, formData);
    await connectDb();
    if (!(await rateLimit(`request-access:${await clientIp()}`, 5, 3600))) {
      throw new ActionError("Too many requests from this network. Please try again later.");
    }

    // Respond identically whether or not the email is already known, so the
    // form cannot be used to discover who has an account.
    const [existingUser, openRequest] = await Promise.all([
      User.exists({ email: data.email }),
      RegistrationRequest.exists({ email: data.email, status: { $in: ["PENDING_APPROVAL", "PENDING_VERIFICATION"] } }),
    ]);
    if (!existingUser && !openRequest) {
      const locale = await getLocale();
      await RegistrationRequest.create({ ...data, status: "PENDING_APPROVAL", locale });
      await logPlatform("MANAGER_REGISTERED", msg("{name} ({company}) requested access", { name: data.fullName, company: data.company }), { id: null, name: data.fullName });
      await queueEmail({ to: data.email, ...emailTemplates.requestReceived(locale, { name: data.fullName }) });
    }
    go("/request-access/submitted");
  });
}

/* ─── Login / logout ─────────────────────────────────────────────────── */

const loginSchema = z.object({ email: zEmail, password: z.string().min(1, "Enter your password").max(128) });

export async function login(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { email, password } = parseForm(loginSchema, formData);
    await connectDb();
    if (!(await rateLimit(`login:${await clientIp()}:${email}`, 8, 900))) {
      throw new ActionError("Too many sign-in attempts. Please wait 15 minutes and try again.");
    }

    const user = await User.findOne({ email }).select("+passwordHash").lean();
    if (!user) {
      await burnPasswordCheck(password);
      throw new ActionError(GENERIC_LOGIN_ERROR);
    }
    if (!(await verifyPassword(password, user.passwordHash))) throw new ActionError(GENERIC_LOGIN_ERROR);

    // Only reveal account state after the password has been proven.
    if (user.disabledAt) throw new ActionError("This account has been disabled. Contact your administrator.");
    if (user.role !== "OWNER") {
      const workspace = await Workspace.findById(user.workspaceId).select("disabledAt").lean();
      if (!workspace || workspace.disabledAt) throw new ActionError("This workspace has been disabled. Contact support.");
    }

    await createSession(String(user._id));
    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
    go(HOME_BY_ROLE[user.role]);
  });
}

export async function logout(): Promise<void> {
  await destroyCurrentSession();
  redirect("/login");
}

/* ─── Manager account setup (email verification + password) ──────────── */

const setupSchema = z.object({
  token: z.string().min(20).max(200),
  password: zPassword,
  workspaceName: z.string().trim().min(2).max(160),
  timezone: z.string().refine(isValidTimezone, "Select a valid timezone"),
});

export async function completeSetup(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const data = parseForm(setupSchema, formData);
    await connectDb();

    // Claiming the token atomically makes the link strictly single-use.
    const token = await AuthToken.findOneAndUpdate(
      { tokenHash: hashToken(data.token), type: "SETUP", usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
    ).lean();
    if (!token?.requestId) throw new ActionError("This setup link is invalid or has expired. Ask us to send a new one.");

    const request = await RegistrationRequest.findOne({ _id: token.requestId, status: "PENDING_VERIFICATION" });
    if (!request) throw new ActionError("This setup link is no longer valid.");
    if (await User.exists({ email: request.email })) throw new ActionError("An account with this email already exists. Try signing in.");

    const userId = new Types.ObjectId();
    const workspaceId = new Types.ObjectId();
    await Workspace.create({ _id: workspaceId, name: data.workspaceName, managerId: userId, timezone: data.timezone, accountStatus: "PENDING_PAYMENT" });
    try {
      await User.create({
        _id: userId,
        name: request.fullName,
        email: request.email,
        phone: request.phone,
        passwordHash: await hashPassword(data.password),
        role: "MANAGER",
        workspaceId,
        locale: await getLocale(),
        // Opening the emailed link proves ownership of the address.
        emailVerifiedAt: new Date(),
      });
    } catch (err) {
      await Workspace.deleteOne({ _id: workspaceId });
      throw err;
    }

    request.status = "COMPLETED";
    request.workspaceId = workspaceId;
    await request.save();

    await logPlatform("WORKSPACE_CREATED", msg('Workspace "{workspace}" created for {name}', { workspace: data.workspaceName, name: request.fullName }), { id: String(userId), name: request.fullName }, String(workspaceId));
    await createSession(String(userId));
    go("/workspace/account");
  });
}

/* ─── Employee invitation acceptance ─────────────────────────────────── */

const acceptInviteSchema = z.object({
  token: z.string().min(20).max(200),
  name: zName,
  phone: zOptionalPhone,
  password: zPassword,
});

export async function acceptInvitation(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const data = parseForm(acceptInviteSchema, formData);
    await connectDb();

    const invitation = await Invitation.findOneAndUpdate(
      { tokenHash: hashToken(data.token), acceptedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { acceptedAt: new Date() } },
    ).lean();
    if (!invitation) throw new ActionError("This invitation is invalid or has expired. Ask your manager to send a new one.");

    const workspace = await Workspace.findById(invitation.workspaceId).lean();
    if (!workspace || workspace.disabledAt) throw new ActionError("This workspace is not available.");
    if (await User.exists({ email: invitation.email })) throw new ActionError("An account with this email already exists. Try signing in.");

    const user = await User.create({
      name: data.name,
      email: invitation.email,
      phone: data.phone ?? invitation.phone ?? null,
      jobTitle: invitation.jobTitle ?? null,
      passwordHash: await hashPassword(data.password),
      role: "EMPLOYEE",
      workspaceId: invitation.workspaceId,
      locale: await getLocale(),
      emailVerifiedAt: new Date(),
    });

    const workspaceId = String(invitation.workspaceId);
    const employeeCount = await User.countDocuments({ workspaceId, role: "EMPLOYEE", disabledAt: null });
    const actor = { id: String(user._id), name: user.name };
    await logWorkspace(workspaceId, "EMPLOYEE_JOINED", msg("{name} joined the team", { name: user.name }), actor);
    // The owner sees the head-count only, not who joined.
    await logPlatform("EMPLOYEE_COUNT_CHANGED", msg("{workspace} now has {count} employees", { workspace: workspace.name, count: employeeCount }), { id: null, name: "System" }, workspaceId, { employeeCount });
    await notify({
      userId: String(workspace.managerId),
      workspaceId,
      type: "TEAM",
      title: msg("{name} accepted your invitation", { name: user.name }),
      href: "/workspace/team",
    });

    await createSession(String(user._id));
    go("/my");
  });
}

/* ─── Password reset ─────────────────────────────────────────────────── */

export async function requestPasswordReset(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const { email } = parseForm(z.object({ email: zEmail }), formData);
    await connectDb();
    const allowed = (await rateLimit(`reset:${await clientIp()}`, 5, 3600)) && (await rateLimit(`reset-email:${email}`, 3, 3600));

    const user = allowed ? await User.findOne({ email, disabledAt: null }).lean() : null;
    if (user) {
      await AuthToken.deleteMany({ userId: user._id, type: "PASSWORD_RESET" });
      const { raw, hash } = generateToken();
      await AuthToken.create({ type: "PASSWORD_RESET", tokenHash: hash, userId: user._id, expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000) });
      await queueEmail({
        to: user.email,
        ...emailTemplates.passwordReset(user.locale, { name: user.name, resetUrl: appUrl(`/reset-password/${raw}`), expiresInMinutes: RESET_TTL_MINUTES }),
      });
    }
    // Same response either way: no account enumeration.
    return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
  });
}

const resetSchema = z.object({ token: z.string().min(20).max(200), password: zPassword });

export async function resetPassword(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const data = parseForm(resetSchema, formData);
    await connectDb();
    const token = await AuthToken.findOneAndUpdate(
      { tokenHash: hashToken(data.token), type: "PASSWORD_RESET", usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
    ).lean();
    if (!token?.userId) throw new ActionError("This reset link is invalid or has expired. Request a new one.");

    await User.updateOne({ _id: token.userId }, { $set: { passwordHash: await hashPassword(data.password) } });
    await destroyAllSessions(String(token.userId));
    go("/login?reset=1");
  });
}

/* ─── Signed-in account management (all roles) ───────────────────────── */

const profileSchema = z.object({ name: zName, phone: zOptionalPhone });

export async function updateProfile(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    const data = parseForm(profileSchema, formData);
    await User.updateOne({ _id: user.id }, { $set: { name: data.name, phone: data.phone } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Profile updated." };
  });
}

const changePasswordSchema = z.object({ currentPassword: z.string().min(1, "Enter your current password").max(128), newPassword: zPassword });

export async function changePassword(formData: FormData): Promise<ActionState> {
  return run(async () => {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) redirect("/login");
    const data = parseForm(changePasswordSchema, formData);
    if (!(await rateLimit(`change-password:${sessionUser.id}`, 5, 900))) throw new ActionError("Too many attempts. Please try again later.");

    const user = await User.findById(sessionUser.id).select("+passwordHash").lean();
    if (!user || !(await verifyPassword(data.currentPassword, user.passwordHash))) {
      return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { currentPassword: ["Current password is incorrect"] } };
    }
    await User.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(data.newPassword) } });
    // Sign out every other device, then start a fresh session for this one.
    await destroyAllSessions(sessionUser.id);
    await createSession(sessionUser.id);
    return { ok: true, message: "Password changed. Other devices have been signed out." };
  });
}
