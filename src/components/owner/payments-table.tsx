import { Banknote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Table, Td, Th } from "@/components/ui/primitives";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { IPayment } from "@/models";
import { VoidPaymentModal } from "./subscription-modals";
import { getT } from "@/lib/i18n/server";

interface Props {
  payments: IPayment[];
  currency: string;
  /** Workspace id → display name. Omit to hide the column (single-workspace views). */
  workspaceNames?: Map<string, string>;
  /** Owner views can void; the manager's own billing page cannot. */
  canVoid?: boolean;
}

export async function PaymentsTable({ payments, currency, workspaceNames, canVoid }: Props) {
  const t = await getT();
  if (payments.length === 0) return <EmptyState icon={<Banknote />} title={t("No payments recorded")} description={t("Payments appear here as soon as they are recorded.")} />;

  return (
    <Table>
      <thead>
        <tr>
          <Th>{t("Paid on")}</Th>
          {workspaceNames && <Th>{t("Workspace")}</Th>}
          <Th className="text-end">{t("Amount")}</Th>
          <Th>{t("Method")}</Th>
          <Th>{t("Period")}</Th>
          <Th>{t("Reference")}</Th>
          {canVoid && <Th />}
        </tr>
      </thead>
      <tbody>
        {payments.map((p) => (
          <tr key={String(p._id)} className={cn(p.voidedAt && "text-muted")}>
            <Td label={t("Paid on")}>{t.date(p.paidAt)}</Td>
            {workspaceNames && <Td label={t("Workspace")}>{workspaceNames.get(String(p.workspaceId)) ?? "—"}</Td>}
            <Td label={t("Amount")} className={cn("text-end font-medium tabular-nums", p.voidedAt && "line-through")}>{t.money(p.amountCents, currency)}</Td>
            <Td label={t("Method")}>{t(PAYMENT_METHOD_LABELS[p.method])}</Td>
            <Td label={t("Period")} className="whitespace-nowrap">
              {t.date(p.periodStart)} – {t.date(p.periodEnd)}
            </Td>
            <Td label={t("Reference")} className="max-w-56">
              <span className="block truncate" title={[p.reference, p.note].filter(Boolean).join(" — ")}>
                {p.reference || p.note || "—"}
              </span>
              {p.voidedAt && <span className="block truncate text-xs">{t("Void:")} {p.voidReason}</span>}
            </Td>
            {canVoid && (
              <Td className="text-end">
                {p.voidedAt ? (
                  <Badge>{t("Void")}</Badge>
                ) : (
                  <VoidPaymentModal
                    paymentId={String(p._id)}
                    trigger={
                      <Button size="sm" variant="ghost">
                        {t("Void")}
                      </Button>
                    }
                  />
                )}
              </Td>
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
