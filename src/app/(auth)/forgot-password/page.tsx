import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Input } from "@/components/ui/input";
import { env } from "@/lib/env";
import { getT } from "@/lib/i18n/server";
import { requestPasswordReset } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Reset password" };

export default async function ForgotPasswordPage() {
  const t = await getT();
  // Without an email service a reset email can never arrive, so say who can help instead.
  const emailAvailable = env().EMAIL_PROVIDER !== "console";
  const footer = (
    <Link href="/login" className="font-medium text-brand hover:underline">
      {t("Back to log in")}
    </Link>
  );

  if (!emailAvailable) {
    return (
      <AuthCard
        title={t("Reset your password")}
        description={t("Ask your manager for a password reset link. Managers can get one from the platform owner. The link lets you choose a new password.")}
        footer={footer}
      />
    );
  }

  return (
    <AuthCard title={t("Reset your password")} description={t("Enter your email and we'll send you a link to choose a new password.")} footer={footer}>
      <ActionForm action={requestPasswordReset} inlineSuccess className="space-y-4">
        <Field label={t("Email")} name="email">
          <Input name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <SubmitButton className="w-full">{t("Send reset link")}</SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
