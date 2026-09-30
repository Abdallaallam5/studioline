import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Request received" };

export default async function RequestSubmittedPage() {
  const t = await getT();
  return (
    <AuthCard title={t("Your request is being reviewed")}>
      <div className="-mt-2 space-y-4 text-sm leading-relaxed text-ink-soft">
        <div className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand">
          <MailCheck className="size-5" />
        </div>
        <p>{t("Thanks — we've received your request. Our team reviews each one by hand, usually within one business day.")}</p>
        <ol className="list-decimal space-y-1.5 ps-5">
          <li>{t("We review your request.")}</li>
          <li>{t("You receive an email with a secure link to verify your address and set a password.")}</li>
          <li>{t("Your workspace is created and activated once your subscription is confirmed.")}</li>
        </ol>
        <p className="text-muted">{t("Nothing arrived? Check your spam folder before submitting again.")}</p>
        <Link href="/" className={buttonClass({ variant: "secondary", className: "w-full" })}>
          {t("Back to home")}
        </Link>
      </div>
    </AuthCard>
  );
}
