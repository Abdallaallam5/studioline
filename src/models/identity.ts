import { Schema } from "mongoose";
import { ROLES, type Role } from "@/lib/constants";
import { getModel, type Id, type Timestamps } from "./helpers";

/* ─── User ───────────────────────────────────────────────────────────── */

export interface IUser extends Timestamps {
  _id: Id;
  name: string;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  passwordHash: string;
  role: Role;
  /** Null only for the platform owner. */
  workspaceId?: Id | null;
  emailVerifiedAt?: Date | null;
  /** Set when an owner (for managers) or a manager (for employees) blocks sign-in. */
  disabledAt?: Date | null;
  lastLoginAt?: Date | null;
  /** Interface language; emails to this user are written in it. */
  locale?: string | null;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, default: null },
    jobTitle: { type: String, default: null, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", default: null, index: true },
    emailVerifiedAt: { type: Date, default: null },
    disabledAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    locale: { type: String, default: null },
  },
  { timestamps: true },
);

export const User = getModel<IUser>("User", userSchema);

/* ─── Session ────────────────────────────────────────────────────────── */

export interface ISession extends Timestamps {
  _id: Id;
  /** SHA-256 of the cookie value; the raw token is never stored. */
  tokenHash: string;
  userId: Id;
  expiresAt: Date;
  userAgent?: string | null;
}

const sessionSchema = new Schema<ISession>(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    userAgent: { type: String, default: null, maxlength: 300 },
  },
  { timestamps: true },
);

export const Session = getModel<ISession>("Session", sessionSchema);

/* ─── One-time tokens (account setup, password reset) ────────────────── */

export const AUTH_TOKEN_TYPES = ["SETUP", "PASSWORD_RESET"] as const;
export type AuthTokenType = (typeof AUTH_TOKEN_TYPES)[number];

export interface IAuthToken extends Timestamps {
  _id: Id;
  type: AuthTokenType;
  tokenHash: string;
  /** PASSWORD_RESET tokens point at a user; SETUP tokens at a registration request. */
  userId?: Id | null;
  requestId?: Id | null;
  expiresAt: Date;
  usedAt?: Date | null;
}

const authTokenSchema = new Schema<IAuthToken>(
  {
    type: { type: String, enum: AUTH_TOKEN_TYPES, required: true },
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    requestId: { type: Schema.Types.ObjectId, ref: "RegistrationRequest", default: null, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 60 * 60 * 24 * 7 } },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const AuthToken = getModel<IAuthToken>("AuthToken", authTokenSchema);

/* ─── Employee invitations ───────────────────────────────────────────── */

export interface IInvitation extends Timestamps {
  _id: Id;
  workspaceId: Id;
  email: string;
  name: string;
  phone?: string | null;
  jobTitle?: string | null;
  tokenHash: string;
  invitedBy: Id;
  expiresAt: Date;
  acceptedAt?: Date | null;
  revokedAt?: Date | null;
}

const invitationSchema = new Schema<IInvitation>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, default: null },
    jobTitle: { type: String, default: null, maxlength: 120 },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Invitation = getModel<IInvitation>("Invitation", invitationSchema);

/* ─── Rate limiting buckets ──────────────────────────────────────────── */

export interface IRateLimit {
  _id: Id;
  key: string;
  count: number;
  expiresAt: Date;
}

const rateLimitSchema = new Schema<IRateLimit>({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export const RateLimit = getModel<IRateLimit>("RateLimit", rateLimitSchema);
