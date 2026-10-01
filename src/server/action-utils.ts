import "server-only";
import { isValidObjectId } from "mongoose";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { renderEnglish, type StoredMessage } from "@/lib/i18n/config";
import { getT } from "@/lib/i18n/server";
import type { ActionState, ShareLink } from "@/lib/utils";
import { normalizePhone } from "@/lib/whatsapp";
import { requireEmployee, requireManager, type WorkspaceContext } from "./context";

/** Text an action reports back: plain English (translated by lookup) or a template with values. */
type Text = string | StoredMessage;

/** What an action body may return; `run` turns it into a localized ActionState. */
export interface ActionResult {
  ok?: boolean;
  message?: Text;
  error?: Text;
  fieldErrors?: Record<string, string[] | undefined>;
  share?: ShareLink;
  redirectTo?: string;
}

/**
 * Ask the client to navigate after a successful action. Unlike Next's redirect(),
 * this returns normally, so the browser never sees a failed request while the
 * redirect is in flight (which showed up as a brief "could not reach the server").
 */
class RedirectSignal extends Error {
  constructor(public readonly path: string) {
    super(`redirect:${path}`);
  }
}

export function go(path: string): never {
  throw new RedirectSignal(path);
}

/** An expected failure whose message is safe to show to the user. */
export class ActionError extends Error {
  constructor(public readonly text: Text) {
    super(typeof text === "string" ? text : renderEnglish(text));
  }
}

export const SUSPENDED_MESSAGE = "Your workspace subscription is not active, so changes are disabled. Your data is safe.";

/**
 * Wrap a server action body: validation and ActionErrors become a friendly
 * ActionState, redirects pass through, and anything unexpected is logged and
 * reported generically so internals never leak to the client. Every message
 * is translated into the caller's interface language on the way out.
 */
export async function run(fn: () => Promise<ActionResult | void>): Promise<ActionState> {
  let result: ActionResult;
  try {
    result = (await fn()) ?? { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof z.ZodError) {
      result = { ok: false, error: "Please check the highlighted fields.", fieldErrors: z.flattenError(err).fieldErrors };
    } else if (err instanceof RedirectSignal) {
      result = { ok: true, redirectTo: err.path };
    } else if (err instanceof ActionError) {
      result = { ok: false, error: err.text };
    } else {
      console.error("[action] unexpected error:", err);
      result = { ok: false, error: "Something went wrong. Please try again." };
    }
  }

  const t = await getT();
  const localize = (text: Text | undefined) => (text === undefined ? undefined : typeof text === "string" ? t(text) : t.msg(text));
  return {
    ok: result.ok,
    message: localize(result.message),
    error: localize(result.error),
    share: result.share,
    redirectTo: result.redirectTo,
    fieldErrors: result.fieldErrors && Object.fromEntries(Object.entries(result.fieldErrors).map(([field, errors]) => [field, errors?.map((e) => t(e))])),
  };
}

/** Manager guard for mutations: also requires a subscription that permits writes. */
export async function requireManagerWrite(): Promise<WorkspaceContext> {
  const ctx = await requireManager({ allowRestricted: true });
  if (!ctx.access.write) throw new ActionError(SUSPENDED_MESSAGE);
  return ctx;
}

export async function requireEmployeeWrite(): Promise<WorkspaceContext> {
  const ctx = await requireEmployee({ allowRestricted: true });
  if (!ctx.access.write) throw new ActionError("This workspace is paused. Ask your manager for details.");
  return ctx;
}

/** FormData → plain object. Repeated keys ending in "[]" become arrays. */
export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = formData.getAll(key).filter((v): v is string => typeof v === "string");
    if (key.endsWith("[]")) out[key.slice(0, -2)] = values.filter((v) => v !== "");
    else out[key] = values[0] ?? "";
  }
  return out;
}

export function parseForm<T extends z.ZodType>(schema: T, formData: FormData): z.infer<T> {
  return schema.parse(formToObject(formData));
}

/* ─── Reusable field schemas ─────────────────────────────────────────── */

export const zId = z.string().refine((v) => isValidObjectId(v) && v.length === 24, "Invalid id");
export const zIdList = z.array(zId).max(200).default([]);
export const zOptionalId = z.union([z.literal(""), zId]).transform((v) => v || null);
export const zEmail = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254));
export const zName = z.string().trim().min(2, "Enter at least 2 characters").max(120);
export const zPassword = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128)
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Include at least one letter and one number");
export const zPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const normalized = normalizePhone(v);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid phone number with country code" });
      return z.NEVER;
    }
    return normalized;
  });
export const zOptionalPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const normalized = normalizePhone(v);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid phone number with country code" });
      return z.NEVER;
    }
    return normalized;
  });
export const zOptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "This text is too long")
    .optional()
    .transform((v) => v || null);
