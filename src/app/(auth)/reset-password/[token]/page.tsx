import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hashToken } from "@/lib/auth/crypto";
import { connectDb } from "@/lib/db";
import { AuthToken } from "@/models";
import { resetPassword } from "@/server/actions/auth";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const t = await getT();
  const { token } = await params;
  await connectDb();
  const valid = await AuthToken.exists({ tokenHash: hashToken(token), type: "PASSWORD_RESET", usedAt: null, expiresAt: { $gt: new Date() } });

  if (!valid) {
    return (
      <AuthCard title={t("This link has expired")} description={t("Password reset links work once and expire after an hour.")}>
        <Link href="/forgot-password" className={buttonClass({ className: "w-full" })}>
          {t("Request a new link")}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("Choose a new password")} description={t("You'll be signed out on all devices.")}>
      <ActionForm action={resetPassword} hidden={{ token }} className="space-y-4">
        <Field label={t("New password")} name="password" hint={t("At least 10 characters, with a letter and a number.")}>
          <Input name="password" type="password" autoComplete="new-password" required autoFocus />
        </Field>
        <SubmitButton className="w-full">{t("Change password")}</SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
