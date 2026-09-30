import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-10 font-mono text-sm text-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold">{t("Page not found")}</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{t("This page doesn't exist, or you don't have access to it.")}</p>
      <Link href="/" className={buttonClass({ className: "mt-6" })}>
        {t("Back to home")}
      </Link>
    </div>
  );
}
