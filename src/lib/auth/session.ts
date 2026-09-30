import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, type Role } from "@/lib/constants";
import { connectDb } from "@/lib/db";
import { Session, User, Workspace } from "@/models";
import { generateToken, hashToken } from "./crypto";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  role: Role;
  workspaceId: string | null;
}

export async function createSession(userId: string): Promise<void> {
  const { raw, hash } = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await Session.create({ tokenHash: hash, userId, expiresAt, userAgent });
  (await cookies()).set(SESSION_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await connectDb();
    await Session.deleteOne({ tokenHash: hashToken(token) });
  }
  jar.delete(SESSION_COOKIE);
}

/** Sign a user out everywhere (password change, account disabled). */
export async function destroyAllSessions(userId: string): Promise<void> {
  await Session.deleteMany({ userId });
}

/**
 * Resolve the signed-in user from the session cookie. Returns null for missing,
 * expired, or revoked sessions, disabled users, and users of a disabled workspace.
 * Cached for the duration of one request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  await connectDb();
  const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).lean();
  if (!session) return null;

  const user = await User.findById(session.userId).lean();
  if (!user || user.disabledAt) return null;

  if (user.role !== "OWNER") {
    if (!user.workspaceId) return null;
    const workspace = await Workspace.findById(user.workspaceId).select("disabledAt").lean();
    if (!workspace || workspace.disabledAt) return null;
  }

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    jobTitle: user.jobTitle ?? null,
    role: user.role,
    workspaceId: user.workspaceId ? String(user.workspaceId) : null,
  };
});

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
