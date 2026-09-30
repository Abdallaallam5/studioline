import type { ReactNode } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/constants";
import { addMonthsUtc, toDateInputValue } from "@/lib/dates";
import { activateSubscription, rejectRequest, suspendWorkspace, updateSubscription, voidPayment } from "@/server/actions/owner";
import type { ManagerRow } from "@/server/owner-data";
import type { Settings } from "@/server/subscription";
import { RecordPaymentForm, type PaymentTarget } from "./record-payment-form";
import { getT } from "@/lib/i18n/server";

const money = (cents: number) => (cents / 100).toFixed(2);
const utcDate = (d: Date) => toDateInputValue(d, "UTC");

/** Suggested next payment for a workspace: its price, for the period after the current one. */
export function paymentTarget(row: ManagerRow): PaymentTarget | null {
  if (!row.subscription) return null;
  return {
    workspaceId: row.workspaceId,
    label: `${row.manager?.name ?? "Unknown"} — ${row.workspaceName}`,
    amount: money(row.subscription.amountCents),
    periodStart: utcDate(row.subscription.renewalDate),
    periodEnd: utcDate(addMonthsUtc(row.subscription.renewalDate, 1)),
  };
}

export async function RecordPaymentModal({ rows, settings, trigger }: { rows: ManagerRow[]; settings: Settings; trigger: ReactNode }) {
  const t = await getT();
  const targets = rows.map(paymentTarget).filter((t): t is PaymentTarget => t !== null);
  return (
    <Modal trigger={trigger} title={t("Record payment")} description={t("Payments are kept permanently in the ledger and extend the subscription to the period end.")}>
      {targets.length === 0 ? (
        <p className="py-4 text-sm text-muted">{t("No workspace has a subscription yet. Activate a subscription first.")}</p>
      ) : (
        <RecordPaymentForm targets={targets} currency={settings.currency} today={utcDate(new Date())} />
      )}
    </Modal>
  );
}

export async function ActivateSubscriptionModal({ row, settings, trigger }: { row: ManagerRow; settings: Settings; trigger: ReactNode }) {
  const t = await getT();
  const today = new Date();
  return (
    <Modal trigger={trigger} title={row.subscription ? t("Re-activate subscription") : t("Activate subscription")} description={t("{name} gets full access as soon as this is saved.", { name: row.workspaceName })}>
      <ActionForm action={activateSubscription} hidden={{ workspaceId: row.workspaceId }} className="space-y-4">
        <Field label={t("Monthly amount ({currency})", { currency: settings.currency })} name="amount">
          <Input name="amount" inputMode="decimal" defaultValue={money(row.subscription?.amountCents ?? settings.defaultPriceCents)} required />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("Start date")} name="startDate">
            <Input name="startDate" type="date" defaultValue={utcDate(today)} required />
          </Field>
          <Field label={t("Renewal date")} name="renewalDate" hint={t("When the next payment is due.")}>
            <Input name="renewalDate" type="date" defaultValue={utcDate(addMonthsUtc(today, 1))} required />
          </Field>
        </div>
        <Field label={t("Notes")} name="notes" optional>
          <Textarea name="notes" rows={2} defaultValue={row.subscription?.notes ?? ""} maxLength={2000} />
        </Field>

        <fieldset className="space-y-4 rounded-lg border border-line p-3.5">
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <Checkbox name="recordPayment" defaultChecked />
            {t("Record the first payment now")}
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("Payment date")} name="paidAt">
              <Input name="paidAt" type="date" defaultValue={utcDate(today)} max={utcDate(today)} />
            </Field>
            <Field label={t("Payment method")} name="method">
              <Select name="method" defaultValue="BANK_TRANSFER">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(PAYMENT_METHOD_LABELS[m])}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t("Reference")} name="reference" optional>
            <Input name="reference" maxLength={200} />
          </Field>
        </fieldset>

        <div className="flex justify-end">
          <SubmitButton>{t("Activate")}</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}

export async function EditSubscriptionModal({ row, settings, trigger }: { row: ManagerRow; settings: Settings; trigger: ReactNode }) {
  const t = await getT();
  if (!row.subscription) return null;
  return (
    <Modal trigger={trigger} title={t("Edit subscription")} description={t("Changing the renewal date immediately re-evaluates the account status.")}>
      <ActionForm action={updateSubscription} hidden={{ workspaceId: row.workspaceId }} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("Monthly amount ({currency})", { currency: settings.currency })} name="amount">
            <Input name="amount" inputMode="decimal" defaultValue={money(row.subscription.amountCents)} required />
          </Field>
          <Field label={t("Renewal date")} name="renewalDate">
            <Input name="renewalDate" type="date" defaultValue={utcDate(row.subscription.renewalDate)} required />
          </Field>
        </div>
        <Field label={t("Notes")} name="notes" optional>
          <Textarea name="notes" rows={3} defaultValue={row.subscription.notes ?? ""} maxLength={2000} />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>{t("Save changes")}</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}

export async function SuspendModal({ row, trigger }: { row: ManagerRow; trigger: ReactNode }) {
  const t = await getT();
  return (
    <Modal trigger={trigger} size="sm" title={t("Suspend {name}?", { name: row.workspaceName })} description={t("The team loses access until you reinstate the workspace. No data is deleted.")}>
      <ActionForm action={suspendWorkspace} hidden={{ workspaceId: row.workspaceId }} className="space-y-4">
        <Field label={t("Reason")} name="reason" optional hint={t("For your records; shown in the activity log.")}>
          <Textarea name="reason" rows={2} maxLength={500} />
        </Field>
        <div className="flex justify-end">
          <SubmitButton variant="danger">{t("Suspend workspace")}</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}

export async function RejectRequestModal({ requestId, applicant, trigger }: { requestId: string; applicant: string; trigger: ReactNode }) {
  const t = await getT();
  return (
    <Modal trigger={trigger} size="sm" title={t("Reject {name}'s request?", { name: applicant })} description={t("The applicant is notified by email.")}>
      <ActionForm action={rejectRequest} hidden={{ requestId }} className="space-y-4">
        <Field label={t("Reason")} name="reason" optional hint={t("Included in the email if you provide one.")}>
          <Textarea name="reason" rows={3} maxLength={1000} />
        </Field>
        <div className="flex justify-end">
          <SubmitButton variant="danger">{t("Reject request")}</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}

export async function VoidPaymentModal({ paymentId, trigger }: { paymentId: string; trigger: ReactNode }) {
  const t = await getT();
  return (
    <Modal trigger={trigger} size="sm" title={t("Void this payment?")} description={t("The record stays in the ledger, marked as void, and is excluded from revenue totals.")}>
      <ActionForm action={voidPayment} hidden={{ paymentId }} className="space-y-4">
        <Field label={t("Reason")} name="reason">
          <Input name="reason" maxLength={500} placeholder={t("e.g. entered twice")} required />
        </Field>
        <div className="flex justify-end">
          <SubmitButton variant="danger">{t("Void payment")}</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}
