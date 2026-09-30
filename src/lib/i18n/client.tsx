"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { setLocale } from "@/server/actions/locale";
import { DEFAULT_LOCALE, LOCALE_NAMES, type Locale } from "./config";
import { createTranslator, type Translator } from "./translator";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Translator for client components. */
export function useT(): Translator {
  const locale = useContext(LocaleContext);
  return useMemo(() => createTranslator(locale), [locale]);
}

/** Switches between English and Arabic and remembers the choice. */
export function LanguageToggle({ className }: { className?: string }) {
  const locale = useContext(LocaleContext);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next: Locale = locale === "ar" ? "en" : "ar";

  return (
    <button
      type="button"
      disabled={pending}
      lang={next}
      onClick={() =>
        startTransition(async () => {
          await setLocale(next);
          router.refresh();
        })
      }
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-60",
        className,
      )}
    >
      <Languages className="size-4" aria-hidden />
      {LOCALE_NAMES[next]}
    </button>
  );
}
