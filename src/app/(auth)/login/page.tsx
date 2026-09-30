import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth/session";
import { HOME_BY_ROLE } from "@/lib/constants";
import { login } from "@/server/actions/auth";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const t = await getT();
  const user = await getCurrentUser();
  if (user) redirect(HOME_BY_ROLE[user.role]);
  const { reset } = await searchParams;

  return (
    <AuthCard
      title={t("Welcome back")}
      description={t("Log in to your workspace.")}
      footer={
        <>
          {t("New here?")}{" "}
          <Link href="/request-access" className="font-medium text-brand hover:underline">
            {t("Request access")}
          </Link>
        </>
      }
    >
      {reset && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-brand-soft px-3 py-2.5 text-[13px] text-brand">
          {t("Your password was changed. Log in with your new password.")}
        </p>
      )}
      <ActionForm action={login} keepValues className="space-y-4">
        <Field label={t("Email")} name="email">
          <Input name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <Field label={t("Password")} name="password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-[13px] font-medium text-ink-soft hover:text-brand">
            {t("Forgot password?")}
          </Link>
        </div>
        <SubmitButton className="w-full">{t("Log in")}</SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
