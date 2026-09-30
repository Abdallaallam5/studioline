import { Schema } from "mongoose";
import {
  PAYMENT_METHODS,
  REQUEST_STATUSES,
  WORKSPACE_STATUSES,
  type PaymentMethod,
  type RequestStatus,
  type WorkspaceStatus,
} from "@/lib/constants";
import { getModel, type Id, type Timestamps } from "./helpers";

/* ─── Registration request ───────────────────────────────────────────── */

export interface IRegistrationRequest extends Timestamps {
  _id: Id;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  teamSize: string;
  description?: string | null;
  status: RequestStatus;
  reviewedBy?: Id | null;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
  workspaceId?: Id | null;
  /** Language the applicant used; their emails are written in it. */
  locale?: string | null;
}

const registrationRequestSchema = new Schema<IRegistrationRequest>(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true },
    company: { type: String, required: true, trim: true, maxlength: 160 },
    teamSize: { type: String, required: true },
    description: { type: String, default: null, maxlength: 2000 },
    status: { type: String, enum: REQUEST_STATUSES, default: "PENDING_APPROVAL", index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null, maxlength: 1000 },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", default: null },
    locale: { type: String, default: null },
  },
  { timestamps: true },
);

export const RegistrationRequest = getModel<IRegistrationRequest>("RegistrationRequest", registrationRequestSchema);

/* ─── Workspace (tenant) ─────────────────────────────────────────────── */

export interface IWorkspace extends Timestamps {
  _id: Id;
  name: string;
  /** The Project Manager who owns this tenant. */
  managerId: Id;
  /** Persisted result of the centralized status computation (lib/subscription). */
  accountStatus: WorkspaceStatus;
  timezone: string;
  /** Owner-initiated suspension, independent of the billing clock. */
  manualSuspendedAt?: Date | null;
  manualSuspendReason?: string | null;
  /** Owner-initiated lock: nobody in the workspace can sign in. */
  disabledAt?: Date | null;
}

const workspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    managerId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    accountStatus: { type: String, enum: WORKSPACE_STATUSES, default: "PENDING_PAYMENT", index: true },
    timezone: { type: String, default: "UTC" },
    manualSuspendedAt: { type: Date, default: null },
    manualSuspendReason: { type: String, default: null, maxlength: 500 },
    disabledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Workspace = getModel<IWorkspace>("Workspace", workspaceSchema);

/* ─── Subscription (one per workspace) ───────────────────────────────── */

export interface ISubscription extends Timestamps {
  _id: Id;
  workspaceId: Id;
  /** Fixed monthly price in minor units (cents). */
  amountCents: number;
  startDate: Date;
  /** The instant the current paid period ends. */
  renewalDate: Date;
  activatedAt: Date;
  cancelledAt?: Date | null;
  notes?: string | null;
  /** Renewal date for which a reminder email was already sent. */
  reminderSentFor?: Date | null;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, unique: true },
    amountCents: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    renewalDate: { type: Date, required: true, index: true },
    activatedAt: { type: Date, required: true },
    cancelledAt: { type: Date, default: null },
    notes: { type: String, default: null, maxlength: 2000 },
    reminderSentFor: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Subscription = getModel<ISubscription>("Subscription", subscriptionSchema);

/* ─── Payment (append-only ledger) ───────────────────────────────────── */

export interface IPayment extends Timestamps {
  _id: Id;
  workspaceId: Id;
  subscriptionId: Id;
  amountCents: number;
  paidAt: Date;
  method: PaymentMethod;
  reference?: string | null;
  note?: string | null;
  periodStart: Date;
  periodEnd: Date;
  recordedBy: Id;
  /** Payments are never deleted; mistakes are voided and excluded from totals. */
  voidedAt?: Date | null;
  voidReason?: string | null;
}

const paymentSchema = new Schema<IPayment>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription", required: true },
    amountCents: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, required: true, index: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    reference: { type: String, default: null, maxlength: 200 },
    note: { type: String, default: null, maxlength: 1000 },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    voidedAt: { type: Date, default: null },
    voidReason: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true },
);

export const Payment = getModel<IPayment>("Payment", paymentSchema);

/* ─── Platform settings (singleton) ──────────────────────────────────── */

export interface IPlatformSettings extends Timestamps {
  _id: Id;
  key: "platform";
  gracePeriodDays: number;
  defaultPriceCents: number;
  currency: string;
  /** Window used for "renewals coming soon" and reminder emails. */
  renewalSoonDays: number;
}

export const PLATFORM_SETTINGS_DEFAULTS = {
  gracePeriodDays: 3,
  defaultPriceCents: 4900,
  currency: "USD",
  renewalSoonDays: 7,
} as const;

const platformSettingsSchema = new Schema<IPlatformSettings>(
  {
    key: { type: String, default: "platform", unique: true },
    gracePeriodDays: { type: Number, default: PLATFORM_SETTINGS_DEFAULTS.gracePeriodDays, min: 0, max: 90 },
    defaultPriceCents: { type: Number, default: PLATFORM_SETTINGS_DEFAULTS.defaultPriceCents, min: 0 },
    currency: { type: String, default: PLATFORM_SETTINGS_DEFAULTS.currency, uppercase: true, minlength: 3, maxlength: 3 },
    renewalSoonDays: { type: Number, default: PLATFORM_SETTINGS_DEFAULTS.renewalSoonDays, min: 1, max: 60 },
  },
  { timestamps: true },
);

export const PlatformSettings = getModel<IPlatformSettings>("PlatformSettings", platformSettingsSchema);
