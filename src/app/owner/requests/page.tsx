import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import { RejectRequestModal } from "@/components/owner/subscription-modals";
import { ActionButton } from "@/components/ui/action-form";
import { AccountStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, LinkTabs, PageHeader } from "@/components/ui/primitives";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/constants";
import { RegistrationRequest } from "@/models";
import { approveRequest, resendSetupLink } from "@/server/actions/owner";
import { requireOwner } from "@/server/context";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Registration requests" };

const TAB_LABELS: Record<RequestStatus, string> = {
  PENDING_APPROVAL: "Pending",
  PENDING_VERIFICATION: "Awaiting verification",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};
const TAB_ORDER: RequestStatus[] = ["PENDING_APPROVAL", "PENDING_VERIFICATION", "COMPLETED", "REJECTED"];

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const t = await getT();
  await requireOwner();
  const { status: raw } = await searchParams;
  const status: RequestStatus = (REQUEST_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as RequestStatus) : "PENDING_APPROVAL";

  const [requests, counts] = await Promise.all([
    RegistrationRequest.find({ status }).sort({ createdAt: status === "PENDING_APPROVAL" ? 1 : -1 }).limit(200).lean(),
    RegistrationRequest.aggregate<{ _id: RequestStatus; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  const countOf = (s: RequestStatus) => counts.find((c) => c._id === s)?.count ?? 0;

  return (
    <>
      <PageHeader title={t("Registration requests")} description={t("Project Managers apply for access here. Approving sends a secure link to verify their email and set a password.")} />
      <LinkTabs active={status} tabs={TAB_ORDER.map((s) => ({ key: s, label: t(TAB_LABELS[s]), href: `/owner/requests?status=${s}`, count: countOf(s) }))} />

      {requests.length === 0 ? (
        <Card>
          <EmptyState icon={<Inbox />} title={t("No {status} requests", { status: t(TAB_LABELS[status]).toLowerCase() })} description={status === "PENDING_APPROVAL" ? t("When someone requests access from the website, it shows up here.") : undefined} />
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const id = String(r._id);
            return (
              <Card key={id} className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-semibold">{r.fullName}</h2>
                      <AccountStatusBadge status={r.status} />
                    </div>
                    <p className="mt-0.5 text-sm text-ink-soft">{r.company}</p>
                    <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-xs text-muted">{t("Email")}</dt>
                        <dd className="truncate">
                          <a href={`mailto:${r.email}`} className="hover:text-brand hover:underline">
                            {r.email}
                          </a>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">{t("Phone")}</dt>
                        <dd>{r.phone}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">{t("Team size")}</dt>
                        <dd>{r.teamSize} {t("people")}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">{t("Requested")}</dt>
                        <dd>{t.date(r.createdAt)}</dd>
                      </div>
                    </dl>
                    {r.description && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">{r.description}</p>}
                    {r.status === "REJECTED" && r.rejectionReason && <p className="mt-3 text-[13px] text-muted">{t("Reason:")} {r.rejectionReason}</p>}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {r.status === "PENDING_APPROVAL" && (
                      <>
                        <RejectRequestModal requestId={id} applicant={r.fullName} trigger={<Button variant="secondary">{t("Reject")}</Button>} />
                        <ActionButton action={approveRequest} fields={{ requestId: id }}>
                          {t("Approve")}
                        </ActionButton>
                      </>
                    )}
                    {r.status === "PENDING_VERIFICATION" && (
                      <ActionButton action={resendSetupLink} fields={{ requestId: id }} variant="secondary">
                        {t("Resend link")}
                      </ActionButton>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
