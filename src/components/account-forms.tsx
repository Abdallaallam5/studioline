import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Input } from "@/components/ui/input";
import { Card, CardHeader } from "@/components/ui/primitives";
import type { SessionUser } from "@/lib/auth/session";
import { changePassword, updateProfile } from "@/server/actions/auth";
import { getT } from "@/lib/i18n/server";

/** Profile and password forms shared by every role's settings page. */
export async function AccountForms({ user }: { user: SessionUser }) {
  const t = await getT();
  return (
    <>
      <Card>
        <CardHeader title={t("Profile")} description={t("How you appear to your team.")} />
        <ActionForm action={updateProfile} keepValues className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("Full name")} name="name">
              <Input name="name" defaultValue={user.name} autoComplete="name" required maxLength={120} />
            </Field>
            <Field label={t("Email")} name="email" hint={t("Contact support to change your email.")}>
              <Input name="email" defaultValue={user.email} disabled />
            </Field>
          </div>
          <Field label={t("Phone number")} name="phone" optional hint={t("With country code. Used for WhatsApp links.")}>
            <Input name="phone" type="tel" defaultValue={user.phone ?? ""} autoComplete="tel" className="sm:max-w-xs" />
          </Field>
          <div className="flex justify-end">
            <SubmitButton>{t("Save profile")}</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader title={t("Password")} description={t("Changing it signs you out on your other devices.")} />
        <ActionForm action={changePassword} className="space-y-4 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("Current password")} name="currentPassword">
              <Input name="currentPassword" type="password" autoComplete="current-password" required />
            </Field>
            <Field label={t("New password")} name="newPassword" hint={t("At least 10 characters, with a letter and a number.")}>
              <Input name="newPassword" type="password" autoComplete="new-password" required />
            </Field>
          </div>
          <div className="flex justify-end">
            <SubmitButton>{t("Change password")}</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
