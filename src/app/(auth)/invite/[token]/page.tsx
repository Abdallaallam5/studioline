import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hashToken } from "@/lib/auth/crypto";
import { connectDb } from "@/lib/db";
import { Invitation, Workspace } from "@/models";
import { acceptInvitation } from "@/server/actions/auth";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Accept invitation", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const t = await getT();
  const { token } = await params;
  await connectDb();
  const invitation = await Invitation.findOne({ tokenHash: hashToken(token), acceptedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } }).lean();
  const workspace = invitation ? await Workspace.findOne({ _id: invitation.workspaceId, disabledAt: null }).select("name").lean() : null;

  if (!invitation || !workspace) {
    return (
      <AuthCard title={t("This invitation is no longer valid")} description={t("It may have expired, been revoked, or already been used. Ask your manager to send a new one.")}>
        <Link href="/login" className={buttonClass({ className: "w-full" })}>
          {t("Go to log in")}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("Join {name}", { name: workspace.name })} description={t("You're joining as {email}. Set a password to get started.", { email: invitation.email })}>
      <ActionForm action={acceptInvitation} keepValues hidden={{ token }} className="space-y-4">
        <Field label={t("Your name")} name="name">
          <Input name="name" defaultValue={invitation.name} autoComplete="name" required maxLength={120} />
        </Field>
        <Field label={t("Phone number")} name="phone" optional hint={t("With country code. Lets your manager reach you on WhatsApp.")}>
          <Input name="phone" type="tel" defaultValue={invitation.phone ?? ""} autoComplete="tel" />
        </Field>
        <Field label={t("Password")} name="password" hint={t("At least 10 characters, with a letter and a number.")}>
          <Input name="password" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton className="w-full">{t("Accept invitation")}</SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
