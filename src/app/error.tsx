"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">{t("Something went wrong")}</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
        {t("We couldn't load this page. Please try again — if the problem continues, contact support.")}
        {error.digest && <span className="mt-2 block font-mono text-xs">{t("Reference:")} {error.digest}</span>}
      </p>
      <Button onClick={reset} className="mt-6">
        {t("Try again")}
      </Button>
    </div>
  );
}
