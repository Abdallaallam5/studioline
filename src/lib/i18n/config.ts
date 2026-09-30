/** Supported interface languages. Add a locale here, then add its dictionary in translator.ts. */
export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "sl_locale";

export const LOCALE_NAMES: Record<Locale, string> = { en: "English", ar: "العربية" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function dirOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Locale passed to Intl. Arabic keeps Latin digits so numbers match across the app. */
export function intlLocale(locale: Locale): string {
  return locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB";
}

/**
 * A translatable message stored in the database (notifications, activity log):
 * the English template plus its values, so it can be rendered later in the
 * reader's language rather than the writer's.
 *
 * Placeholders look like `{name}`. A placeholder starting with `t_` — `{t_status}` —
 * marks a value that is itself translatable text (a status or reason label), and
 * one starting with `d_` holds an ISO date that is formatted for the reader's locale.
 */
export interface StoredMessage {
  k: string;
  p?: Record<string, string | number>;
}

export function msg(template: string, params?: Record<string, string | number>): StoredMessage {
  return params ? { k: template, p: params } : { k: template };
}

export function interpolate(template: string, params?: Record<string, string | number | null | undefined>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key] ?? "") : match));
}

/** Render a stored message in English (the fallback text kept alongside it). */
export function renderEnglish(message: StoredMessage): string {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(message.p ?? {})) {
    params[key] = key.startsWith("d_") ? new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : value;
  }
  return interpolate(message.k, params);
}
