import "server-only";
import { after } from "next/server";
import { env } from "@/lib/env";

/**
 * Email service abstraction. To add a provider: implement `EmailProvider`,
 * register it in `providers`, and add its name to EMAIL_PROVIDER in lib/env.ts.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage & { from: string }): Promise<void>;
}

const consoleProvider: EmailProvider = {
  async send(message) {
    console.info(`\n──── email (console provider) ────\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n──────────────────────────────────\n`);
  },
};

const isGmail = (host?: string) => /(^|\.)gmail\.com$|googlemail\.com$/i.test(host ?? "");

type Transport = { sendMail(message: EmailMessage & { from: string }): Promise<unknown> };
let cachedTransport: { key: string; transport: Transport } | null = null;

async function smtpTransport(): Promise<Transport> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = env();
  if (!SMTP_HOST) throw new Error("SMTP_HOST is not set");
  if (SMTP_USER && !SMTP_PASSWORD) throw new Error("SMTP_PASSWORD is not set");

  // Google shows app passwords in groups of four ("abcd efgh ijkl mnop"); the spaces are not part of it.
  const pass = SMTP_PASSWORD && isGmail(SMTP_HOST) ? SMTP_PASSWORD.replace(/\s+/g, "") : SMTP_PASSWORD;
  const key = [SMTP_HOST, SMTP_PORT, SMTP_USER, pass].join("|");
  if (cachedTransport?.key === key) return cachedTransport.transport;

  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass } : undefined,
    // Fail fast instead of hanging a request until the platform kills it.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  cachedTransport = { key, transport };
  return transport;
}

/** Gmail only sends as the signed-in account, so the From address has to match it. */
function fromAddress(from: string): string {
  const { SMTP_HOST, SMTP_USER } = env();
  if (!isGmail(SMTP_HOST) || !SMTP_USER) return from;
  const name = /^\s*"?([^"<]*?)"?\s*<[^>]*>\s*$/.exec(from)?.[1]?.trim();
  return name ? `${name} <${SMTP_USER}>` : SMTP_USER;
}

const smtpProvider: EmailProvider = {
  async send(message) {
    await (await smtpTransport()).sendMail({ ...message, from: fromAddress(message.from) });
  },
};

const resendProvider: EmailProvider = {
  async send(message) {
    const { RESEND_API_KEY } = env();
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: message.from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  },
};

const providers: Record<ReturnType<typeof env>["EMAIL_PROVIDER"], EmailProvider> = {
  console: consoleProvider,
  smtp: smtpProvider,
  resend: resendProvider,
};

export interface EmailStatus {
  provider: "console" | "smtp" | "resend";
  /** True when a real provider is selected; with "console" nothing leaves the server. */
  enabled: boolean;
  /** The address mail is sent from, or the SMTP host/provider name. */
  detail: string | null;
}

export function emailStatus(): EmailStatus {
  const { EMAIL_PROVIDER, EMAIL_FROM, SMTP_HOST, SMTP_USER } = env();
  if (EMAIL_PROVIDER === "console") return { provider: "console", enabled: false, detail: null };
  if (EMAIL_PROVIDER === "smtp") return { provider: "smtp", enabled: true, detail: `${SMTP_USER ?? EMAIL_FROM} via ${SMTP_HOST ?? "?"}` };
  return { provider: "resend", enabled: true, detail: EMAIL_FROM };
}

export interface SendResult {
  ok: boolean;
  /** Technical reason, for the owner's diagnostics only — never shown to ordinary users. */
  error?: string;
}

/** Send an email and report why it failed. Never throws. */
export async function sendEmailDetailed(message: EmailMessage): Promise<SendResult> {
  const { EMAIL_PROVIDER, EMAIL_FROM } = env();
  if (EMAIL_PROVIDER === "console") {
    await consoleProvider.send({ ...message, from: EMAIL_FROM });
    return { ok: false, error: "EMAIL_PROVIDER is set to “console”, so nothing is sent." };
  }
  try {
    await providers[EMAIL_PROVIDER].send({ ...message, from: EMAIL_FROM });
    return { ok: true };
  } catch (err) {
    console.error(`[email] failed to send "${message.subject}" via ${EMAIL_PROVIDER}:`, err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send an email. Never throws: a mail outage must not roll back the action that
 * triggered it. Returns whether a real provider accepted the message; with the
 * console provider nothing leaves the server, so it reports false and callers
 * offer the link for manual sharing instead.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  return (await sendEmailDetailed(message)).ok;
}

/**
 * Send an email after the response has gone out, so a slow mail server never
 * delays the page. For notifications nobody needs to wait on; use `sendEmail`
 * when the caller reports the outcome (setup and invitation links).
 */
export async function queueEmail(message: EmailMessage): Promise<void> {
  try {
    after(() => sendEmail(message));
  } catch {
    // Not inside a request (scripts, tests): send inline instead.
    await sendEmail(message);
  }
}
