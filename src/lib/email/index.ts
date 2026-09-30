import "server-only";
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

const smtpProvider: EmailProvider = {
  async send(message) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = env();
    if (!SMTP_HOST) throw new Error("SMTP_HOST is not configured");
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
    });
    await transport.sendMail(message);
  },
};

const resendProvider: EmailProvider = {
  async send(message) {
    const { RESEND_API_KEY } = env();
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: message.from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    });
    if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  },
};

const providers: Record<ReturnType<typeof env>["EMAIL_PROVIDER"], EmailProvider> = {
  console: consoleProvider,
  smtp: smtpProvider,
  resend: resendProvider,
};

/**
 * Send an email. Never throws: a mail outage must not roll back the action that
 * triggered it. Returns whether a real provider accepted the message; with the
 * console provider nothing leaves the server, so it reports false and callers
 * offer the link for manual sharing instead.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const { EMAIL_PROVIDER, EMAIL_FROM } = env();
  try {
    await providers[EMAIL_PROVIDER].send({ ...message, from: EMAIL_FROM });
    return EMAIL_PROVIDER !== "console";
  } catch (err) {
    console.error(`[email] failed to send "${message.subject}" via ${EMAIL_PROVIDER}:`, err);
    return false;
  }
}
