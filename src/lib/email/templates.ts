import "server-only";
import { BRAND } from "@/lib/brand";
import { translatorFor } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translator";
import type { EmailMessage } from "./index";

type Content = Omit<EmailMessage, "to">;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

interface LayoutInput {
  subject: string;
  heading: string;
  /** Plain-text paragraphs; escaped before being placed in the HTML body. */
  paragraphs: string[];
  cta?: { label: string; url: string };
  footnote?: string;
}

function layout(t: Translator, { subject, heading, paragraphs, cta, footnote }: LayoutInput): Content {
  const align = t.dir === "rtl" ? "right" : "left";
  const footer = footnote ?? t("You are receiving this email because of your {brand} account.", { brand: BRAND.name });
  const html = `<!doctype html>
<html lang="${t.locale}" dir="${t.dir}">
  <body style="margin:0;padding:32px 16px;background:#f6f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a18;">
    <table role="presentation" dir="${t.dir}" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e0;border-radius:12px;text-align:${align};">
      <tr><td style="padding:28px 32px 8px;font-size:14px;font-weight:600;letter-spacing:-0.01em;color:#1f5f4f;">${escapeHtml(BRAND.name)}</td></tr>
      <tr><td style="padding:0 32px;font-size:20px;font-weight:600;">${escapeHtml(heading)}</td></tr>
      <tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.6;color:#44443f;">
        ${paragraphs.map((p) => `<p style="margin:0 0 12px;">${escapeHtml(p)}</p>`).join("")}
      </td></tr>
      ${
        cta
          ? `<tr><td style="padding:8px 32px 8px;"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#1f5f4f;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:8px;">${escapeHtml(cta.label)}</a></td></tr>
             <tr><td style="padding:8px 32px 0;font-size:12px;line-height:1.5;color:#8a8983;word-break:break-all;">${escapeHtml(t("Or paste this link into your browser:"))}<br><span dir="ltr">${escapeHtml(cta.url)}</span></td></tr>`
          : ""
      }
      <tr><td style="padding:20px 32px 28px;font-size:12px;line-height:1.5;color:#8a8983;">${escapeHtml(footer)}</td></tr>
    </table>
  </body>
</html>`;

  const text = [heading, "", ...paragraphs, ...(cta ? ["", `${cta.label}: ${cta.url}`] : []), "", footnote ?? `— ${BRAND.name}`].join("\n");
  return { subject, html, text };
}

/** `locale` is the recipient's language (a user's saved preference, or the sender's when unknown). */
type Locale = string | null | undefined;
const brand = BRAND.name;

export const emailTemplates = {
  requestReceived: (locale: Locale, p: { name: string }) => {
    const t = translatorFor(locale);
    return layout(t, {
      subject: t("We received your {brand} access request", { brand }),
      heading: t("Your request is being reviewed"),
      paragraphs: [
        t("Hi {name},", { name: p.name }),
        t("Thanks for your interest in {brand}. We review every request by hand and will email you as soon as a decision is made.", { brand }),
      ],
    });
  },

  requestApproved: (locale: Locale, p: { name: string; setupUrl: string; expiresInDays: number }) => {
    const t = translatorFor(locale);
    return layout(t, {
      subject: t("Your {brand} workspace is approved", { brand }),
      heading: t("You're approved — set up your account"),
      paragraphs: [
        t("Hi {name},", { name: p.name }),
        t("Your request has been approved. Confirm your email address and choose a password to create your workspace."),
        t("This link works once and expires in {days} days.", { days: p.expiresInDays }),
      ],
      cta: { label: t("Verify email & set password"), url: p.setupUrl },
    });
  },

  requestRejected: (locale: Locale, p: { name: string; reason?: string | null }) => {
    const t = translatorFor(locale);
    return layout(t, {
      subject: t("Update on your {brand} request", { brand }),
      heading: t("We can't approve your request right now"),
      paragraphs: [
        t("Hi {name},", { name: p.name }),
        t("Thank you for applying to {brand}. Unfortunately we are not able to approve your request at this time.", { brand }),
        ...(p.reason ? [t("Note from our team: {reason}", { reason: p.reason })] : []),
      ],
    });
  },

  invitation: (locale: Locale, p: { name: string; managerName: string; workspaceName: string; inviteUrl: string; expiresInDays: number }) => {
    const t = translatorFor(locale);
    return layout(t, {
      subject: t("{manager} invited you to {workspace}", { manager: p.managerName, workspace: p.workspaceName }),
      heading: t("Join {workspace} on {brand}", { workspace: p.workspaceName, brand }),
      paragraphs: [
        t("Hi {name},", { name: p.name }),
        t("{manager} has invited you to join their team workspace. Accept the invitation to see the tasks assigned to you.", { manager: p.managerName }),
        t("This invitation expires in {days} days.", { days: p.expiresInDays }),
      ],
      cta: { label: t("Accept invitation"), url: p.inviteUrl },
      footnote: t("If you weren't expecting this invitation you can ignore this email."),
    });
  },

  passwordReset: (locale: Locale, p: { name: string; resetUrl: string; expiresInMinutes: number }) => {
    const t = translatorFor(locale);
    return layout(t, {
      subject: t("Reset your {brand} password", { brand }),
      heading: t("Reset your password"),
      paragraphs: [t("Hi {name},", { name: p.name }), t("We received a request to reset your password. This link expires in {minutes} minutes.", { minutes: p.expiresInMinutes })],
      cta: { label: t("Choose a new password"), url: p.resetUrl },
      footnote: t("If you didn't request this, you can safely ignore this email — your password won't change."),
    });
  },

  subscriptionActivated: (locale: Locale, p: { name: string; workspaceName: string; renewalDate: Date; appUrl: string }) => {
    const t = translatorFor(locale);
    return layout(t, {
      subject: t("Your {brand} subscription is active", { brand }),
      heading: t("Your workspace is live"),
      paragraphs: [
        t("Hi {name},", { name: p.name }),
        t("The subscription for {workspace} is now active. Your next renewal is on {date}.", { workspace: p.workspaceName, date: t.date(p.renewalDate) }),
      ],
      cta: { label: t("Open your workspace"), url: p.appUrl },
    });
  },

  paymentRecorded: (locale: Locale, p: { name: string; amount: string; paidAt: Date; renewalDate: Date }) => {
    const t = translatorFor(locale);
    return layout(t, {
      subject: t("Payment received — {amount}", { amount: p.amount }),
      heading: t("Payment received"),
      paragraphs: [
        t("Hi {name},", { name: p.name }),
        t("We recorded your payment of {amount} on {date}.", { amount: p.amount, date: t.date(p.paidAt) }),
        t("Your subscription now runs until {date}.", { date: t.date(p.renewalDate) }),
      ],
    });
  },

  renewalReminder: (locale: Locale, p: { name: string; workspaceName: string; renewalDate: Date; amount: string }) => {
    const t = translatorFor(locale);
    const date = t.date(p.renewalDate);
    return layout(t, {
      subject: t("Your {brand} subscription renews on {date}", { brand, date }),
      heading: t("Renewal coming up"),
      paragraphs: [
        t("Hi {name},", { name: p.name }),
        t("The subscription for {workspace} ({amount} per month) renews on {date}. Please arrange payment before then to avoid interruption.", { workspace: p.workspaceName, amount: p.amount, date }),
      ],
    });
  },

  subscriptionPastDue: (locale: Locale, p: { name: string; workspaceName: string; suspensionDate: Date; accountUrl: string }) => {
    const t = translatorFor(locale);
    return layout(t, {
      subject: t("Payment overdue for {workspace}", { workspace: p.workspaceName }),
      heading: t("Your subscription is past due"),
      paragraphs: [
        t("Hi {name},", { name: p.name }),
        t("We haven't recorded a payment for the current period of {workspace}.", { workspace: p.workspaceName }),
        t("Your workspace keeps working for now, but it will be suspended on {date} unless payment is received.", { date: t.date(p.suspensionDate) }),
      ],
      cta: { label: t("View account"), url: p.accountUrl },
    });
  },

  subscriptionSuspended: (locale: Locale, p: { name: string; workspaceName: string; accountUrl: string }) => {
    const t = translatorFor(locale);
    return layout(t, {
      subject: t("{workspace} has been suspended", { workspace: p.workspaceName }),
      heading: t("Your workspace is suspended"),
      paragraphs: [
        t("Hi {name},", { name: p.name }),
        t("{workspace} has been suspended. Your projects, tasks, and files are preserved, and access is restored as soon as the subscription is renewed.", { workspace: p.workspaceName }),
      ],
      cta: { label: t("View account"), url: p.accountUrl },
    });
  },

  taskAssigned: (locale: Locale, p: { name: string; title: string; projectName: string; deadline: Date | null | undefined; timezone: string; taskUrl: string }) => {
    const t = translatorFor(locale);
    return layout(t, {
      subject: t("New task: {title}", { title: p.title }),
      heading: t("You have a new task"),
      paragraphs: [
        t("Hi {name},", { name: p.name }),
        t('"{title}" in {project} has been assigned to you.', { title: p.title, project: p.projectName }),
        t("Deadline: {deadline}", { deadline: t.deadline(p.deadline, p.timezone) }),
      ],
      cta: { label: t("Open task"), url: p.taskUrl },
    });
  },
};
