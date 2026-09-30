"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/ui/action-form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "@/lib/constants";
import { recordPayment } from "@/server/actions/owner";
import { useT } from "@/lib/i18n/client";

export interface PaymentTarget {
  workspaceId: string;
  label: string;
  /** Suggested values, derived from the subscription: its price and next unpaid period. */
  amount: string;
  periodStart: string;
  periodEnd: string;
}

export function RecordPaymentForm({ targets, currency, today }: { targets: PaymentTarget[]; currency: string; today: string }) {
  const t = useT();
  const [selected, setSelected] = useState(targets.length === 1 ? targets[0].workspaceId : "");
  const target = targets.find((t) => t.workspaceId === selected);

  return (
    <ActionForm action={recordPayment} className="space-y-4">
      <Field label={t("Project Manager")} name="workspaceId">
        <Select name="workspaceId" value={selected} onChange={(e) => setSelected(e.target.value)} required>
          {targets.length !== 1 && (
            <option value="" disabled>
              {t("Select a workspace…")}
            </option>
          )}
          {targets.map((t) => (
            <option key={t.workspaceId} value={t.workspaceId}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>

      {/* Re-mount when the workspace changes so the suggested values follow it. */}
      <div key={selected} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("Amount ({currency})", { currency })} name="amount">
            <Input name="amount" inputMode="decimal" defaultValue={target?.amount ?? ""} required />
          </Field>
          <Field label={t("Payment date")} name="paidAt">
            <Input name="paidAt" type="date" defaultValue={today} max={today} required />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("Period start")} name="periodStart">
            <Input name="periodStart" type="date" defaultValue={target?.periodStart ?? ""} required />
          </Field>
          <Field label={t("Period end")} name="periodEnd" hint={t("Becomes the next renewal date.")}>
            <Input name="periodEnd" type="date" defaultValue={target?.periodEnd ?? ""} required />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("Payment method")} name="method">
          <Select name="method" defaultValue="BANK_TRANSFER">
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {t(PAYMENT_METHOD_LABELS[m])}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Reference")} name="reference" optional>
          <Input name="reference" maxLength={200} placeholder={t("Transfer ID, receipt no.")} />
        </Field>
      </div>
      <Field label={t("Note")} name="note" optional>
        <Textarea name="note" rows={2} maxLength={1000} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton disabled={!selected}>{t("Record payment")}</SubmitButton>
      </div>
    </ActionForm>
  );
}
