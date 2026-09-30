import { MailPlus, MessageCircle, UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import { ActionButton, ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Avatar, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { whatsappLink } from "@/lib/whatsapp";
import { Invitation } from "@/models";
import { createEmployeeResetLink, inviteEmployee, resendInvitation, revokeInvitation, setEmployeeDisabled, updateEmployee } from "@/server/actions/team";
import { requireManager } from "@/server/context";
import { getTeamLoad } from "@/server/task-data";
import { listEmployees, scope } from "@/server/tenant";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Team" };

async function InviteModal() {
  const t = await getT();
  return (
    <Modal
      title={t("Invite a team member")}
      description={t("They receive an email with a link to set their password and join this workspace.")}
      trigger={
        <Button>
          <UserPlus /> {t("Invite")}
        </Button>
      }
    >
      <ActionForm action={inviteEmployee} className="space-y-4">
        <Field label={t("Full name")} name="name">
          <Input name="name" required maxLength={120} autoFocus />
        </Field>
        <Field label={t("Email")} name="email">
          <Input name="email" type="email" required />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("Job title")} name="jobTitle" optional>
            <Input name="jobTitle" maxLength={120} placeholder={t("e.g. Designer")} />
          </Field>
          <Field label={t("Phone")} name="phone" optional hint={t("With country code, for WhatsApp.")}>
            <Input name="phone" type="tel" />
          </Field>
        </div>
        <div className="flex justify-end">
          <SubmitButton>{t("Send invitation")}</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}

export default async function TeamPage() {
  const t = await getT();
  const ctx = await requireManager();
  const [employees, load, invitations] = await Promise.all([
    listEmployees(ctx, { includeDisabled: true }),
    getTeamLoad(ctx),
    Invitation.find({ ...scope(ctx), acceptedAt: null, revokedAt: null }).sort({ createdAt: -1 }).lean(),
  ]);
  const loadOf = (id: string) => load.find((l) => l.id === id);
  const now = new Date();

  return (
    <>
      <PageHeader title={t("Team")} description={t("The people you assign work to. Employees only see their own tasks.")} actions={<InviteModal />} />

      <Card>
        {employees.length === 0 ? (
          <EmptyState icon={<Users />} title={t("No team members yet")} description={t("Invite the people you work with. They'll get a simple view of just their tasks.")} action={<InviteModal />} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("Name")}</Th>
                <Th>{t("Contact")}</Th>
                <Th className="text-end">{t("Active")}</Th>
                <Th className="text-end">{t("In review")}</Th>
                <Th className="text-end">{t("Completed")}</Th>
                <Th>{t("Joined")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const id = String(e._id);
                const stats = loadOf(id);
                const chat = whatsappLink(e.phone, t("Hi {name}, ", { name: e.name.split(" ")[0] }));
                return (
                  <tr key={id}>
                    <Td>
                      <span className="flex items-center gap-2.5">
                        <Avatar name={e.name} />
                        <span>
                          <span className="flex items-center gap-2 font-medium leading-tight">
                            {e.name}
                            {e.disabledAt && <Badge>{t("Deactivated")}</Badge>}
                          </span>
                          <span className="block text-xs text-muted">{e.jobTitle ?? t("Team member")}</span>
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <span className="block text-[13px]">{e.email}</span>
                      <span className="block text-xs text-muted">{e.phone ?? t("No phone")}</span>
                    </Td>
                    <Td className="text-end tabular-nums">{stats?.active ?? "—"}</Td>
                    <Td className="text-end tabular-nums">{stats?.inReview ?? "—"}</Td>
                    <Td className="text-end tabular-nums">{stats?.completed ?? "—"}</Td>
                    <Td className="text-muted">{t.date(e.createdAt, ctx.workspace.timezone)}</Td>
                    <Td>
                      <span className="flex items-center justify-end gap-1">
                        {chat && !e.disabledAt && (
                          <a href={chat} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "ghost", size: "sm" })} title={t("Message on WhatsApp")}>
                            <MessageCircle /> {t("WhatsApp")}
                          </a>
                        )}
                        <Modal
                          title={t("Edit {name}", { name: e.name })}
                          trigger={
                            <Button variant="ghost" size="sm">
                              {t("Edit")}
                            </Button>
                          }
                        >
                          <ActionForm action={updateEmployee} hidden={{ employeeId: id }} keepValues className="space-y-4">
                            <Field label={t("Full name")} name="name">
                              <Input name="name" defaultValue={e.name} required maxLength={120} />
                            </Field>
                            <Field label={t("Job title")} name="jobTitle" optional>
                              <Input name="jobTitle" defaultValue={e.jobTitle ?? ""} maxLength={120} />
                            </Field>
                            <Field label={t("Phone")} name="phone" optional hint={t("With country code, for WhatsApp.")}>
                              <Input name="phone" type="tel" defaultValue={e.phone ?? ""} />
                            </Field>
                            <div className="flex justify-end">
                              <SubmitButton>{t("Save")}</SubmitButton>
                            </div>
                          </ActionForm>
                        </Modal>
                        {!e.disabledAt && (
                          <ActionButton action={createEmployeeResetLink} fields={{ employeeId: id }} variant="ghost" size="sm">
                            {t("Reset password")}
                          </ActionButton>
                        )}
                        <ActionButton
                          action={setEmployeeDisabled}
                          fields={{ employeeId: id, disabled: e.disabledAt ? "false" : "true" }}
                          variant={e.disabledAt ? "ghost" : "danger-ghost"}
                          size="sm"
                          confirm={e.disabledAt ? undefined : t("Deactivate {name}? They will be signed out and can no longer log in. Their tasks and history are kept.", { name: e.name })}
                        >
                          {e.disabledAt ? t("Reactivate") : t("Deactivate")}
                        </ActionButton>
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {invitations.length > 0 && (
        <Card className="mt-6">
          <CardHeader title={t("Pending invitations")} description={t("Invitations expire after 7 days.")} />
          <ul className="divide-y divide-line">
            {invitations.map((inv) => {
              const expired = inv.expiresAt < now;
              return (
                <li key={String(inv._id)} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-paper text-muted ring-1 ring-line">
                      <MailPlus className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        {inv.name}
                        {expired && <Badge tone="amber">{t("Expired")}</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {inv.email} {t("· sent")} {t.date(inv.updatedAt, ctx.workspace.timezone)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <ActionButton action={resendInvitation} fields={{ invitationId: String(inv._id) }} variant="ghost" size="sm">
                      {t("Resend")}
                    </ActionButton>
                    <ActionButton action={revokeInvitation} fields={{ invitationId: String(inv._id) }} variant="danger-ghost" size="sm" confirm={t("Revoke the invitation for {email}?", { email: inv.email })}>
                      {t("Revoke")}
                    </ActionButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
