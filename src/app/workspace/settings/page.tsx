import type { Metadata } from "next";
import { AccountForms } from "@/components/account-forms";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { updateWorkspace } from "@/server/actions/workspace";
import { requireManager } from "@/server/context";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Settings" };

export default async function WorkspaceSettingsPage() {
  const t = await getT();
  const ctx = await requireManager();

  return (
    <>
      <PageHeader title={t("Settings")} description={t("Your workspace and your own account.")} />
      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader title={t("Workspace")} description={t("Shown to everyone on your team.")} />
          <ActionForm action={updateWorkspace} keepValues className="space-y-4 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("Workspace name")} name="name">
                <Input name="name" defaultValue={ctx.workspace.name} required maxLength={160} />
              </Field>
              <Field label={t("Timezone")} name="timezone" hint={t("Deadlines, “today”, and the calendar follow this timezone.")}>
                <TimezoneSelect defaultValue={ctx.workspace.timezone} />
              </Field>
            </div>
            <div className="flex justify-end">
              <SubmitButton>{t("Save workspace")}</SubmitButton>
            </div>
          </ActionForm>
        </Card>
        <AccountForms user={ctx.user} />
      </div>
    </>
  );
}
