import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { createTranslator, type Translator } from "./translator";

/**
 * The visitor's interface language: their saved choice if they made one,
 * otherwise the browser's preferred language when we support it.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;

  const preferred = (await headers()).get("accept-language")?.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return isLocale(preferred) ? preferred : DEFAULT_LOCALE;
});

/** Translator for server components and server actions. */
export const getT = cache(async (): Promise<Translator> => createTranslator(await getLocale()));

/** Translator for a specific reader — emails are written in the recipient's language. */
export function translatorFor(locale: string | null | undefined): Translator {
  return createTranslator(isLocale(locale) ? locale : DEFAULT_LOCALE);
}
