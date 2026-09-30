import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { hashToken } from "@/lib/auth/crypto";
import { connectDb } from "@/lib/db";
import { AuthToken, RegistrationRequest } from "@/models";
import { completeSetup } from "@/server/actions/auth";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Set up your account", robots: { index: false } };

export default async function SetupPage({ params }: { params: Promise<{ token: string }> }) {
  const t = await getT();
  const { token } = await params;
  await connectDb();
  const record = await AuthToken.findOne({ tokenHash: hashToken(token), type: "SETUP", usedAt: null, expiresAt: { $gt: new Date() } }).lean();
  const request = record?.requestId ? await RegistrationRequest.findOne({ _id: record.requestId, status: "PENDING_VERIFICATION" }).lean() : null;

  if (!request) {
    return (
      <AuthCard title={t("This link is no longer valid")} description={t("Setup links work once and expire after 7 days. If you already set up your account, log in. Otherwise reply to your approval email and we'll send a new link.")}>
        <Link href="/login" className={buttonClass({ className: "w-full" })}>
          {t("Go to log in")}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("Welcome, {name}", { name: request.fullName.split(" ")[0] })} description={t("Your email {email} is verified. Choose a password to create your workspace.", { email: request.email })}>
      <ActionForm action={completeSetup} keepValues hidden={{ token }} className="space-y-4">
        <Field label={t("Workspace name")} name="workspaceName" hint={t("Usually your agency or team name. You can change it later.")}>
          <Input name="workspaceName" defaultValue={request.company} required maxLength={160} />
        </Field>
        <Field label={t("Timezone")} name="timezone" hint={t("Used for deadlines and “today” across your workspace.")}>
          <TimezoneSelect />
        </Field>
        <Field label={t("Password")} name="password" hint={t("At least 10 characters, with a letter and a number.")}>
          <Input name="password" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton className="w-full">{t("Create workspace")}</SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
