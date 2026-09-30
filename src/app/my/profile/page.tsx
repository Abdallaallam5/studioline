import type { Metadata } from "next";
import { AccountForms } from "@/components/account-forms";
import { PageHeader } from "@/components/ui/primitives";
import { requireEmployee } from "@/server/context";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const t = await getT();
  const ctx = await requireEmployee();
  return (
    <>
      <PageHeader title={t("Profile")} description={ctx.user.jobTitle ? t("{jobTitle} at {workspace}.", { jobTitle: ctx.user.jobTitle, workspace: ctx.workspace.name }) : t("Member of {workspace}.", { workspace: ctx.workspace.name })} />
      <div className="max-w-3xl space-y-6">
        <AccountForms user={ctx.user} />
      </div>
    </>
  );
}
