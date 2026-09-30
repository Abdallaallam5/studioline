import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { BRAND } from "@/lib/brand";
import { TEAM_SIZES } from "@/lib/constants";
import { requestAccess } from "@/server/actions/auth";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Request access" };

export default async function RequestAccessPage() {
  const t = await getT();
  return (
    <AuthCard
      title={t("Request access")}
      description={t("Tell us about your team. We review every request and email you a setup link once it's approved.")}
      footer={
        <>
          {t("Already have an account?")}{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            {t("Log in")}
          </Link>
        </>
      }
    >
      <ActionForm action={requestAccess} keepValues className="space-y-4">
        <Field label={t("Full name")} name="fullName">
          <Input name="fullName" autoComplete="name" required maxLength={120} />
        </Field>
        <Field label={t("Work email")} name="email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label={t("Phone number")} name="phone" hint={t("Include your country code, e.g. +971 50 123 4567.")}>
          <Input name="phone" type="tel" autoComplete="tel" required />
        </Field>
        <Field label={t("Company / agency name")} name="company">
          <Input name="company" autoComplete="organization" required maxLength={160} />
        </Field>
        <Field label={t("Approximate team size")} name="teamSize">
          <Select name="teamSize" defaultValue="" required>
            <option value="" disabled>
              {t("Select…")}
            </option>
            {TEAM_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} {t("people")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("What would you use {brand} for?", { brand: BRAND.name })} name="description" optional>
          <Textarea name="description" rows={3} maxLength={2000} />
        </Field>
        <SubmitButton className="w-full">{t("Submit request")}</SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
