import { formatDate, formatDateTime, formatDeadline, greeting, timeAgo } from "@/lib/dates";
import { formatMoney, pluralize } from "@/lib/utils";
import { ar } from "./ar";
import { dirOf, interpolate, type Locale, type StoredMessage } from "./config";

/**
 * English source text is the translation key: `t("Save changes")`. A string
 * missing from a dictionary simply renders in English, so partial translations
 * degrade gracefully and nothing needs a separate key file.
 */
const DICTIONARIES: Record<Locale, Record<string, string> | null> = { en: null, ar };

type Params = Record<string, string | number | null | undefined>;

export interface Translator {
  (text: string, params?: Params): string;
  locale: Locale;
  dir: "ltr" | "rtl";
  /** Counted noun: `t.n(3, "task")` → "3 tasks". */
  n(count: number, singular: string, plural?: string): string;
  date(date: Date | null | undefined, tz?: string): string;
  dateTime(date: Date | null | undefined, tz?: string): string;
  deadline(date: Date | null | undefined, tz: string, now?: Date): string;
  ago(date: Date, now?: Date): string;
  greeting(tz: string, now?: Date): string;
  money(cents: number, currency: string): string;
  /** Render a message stored in the database, falling back to its English text. */
  msg(stored: StoredMessage | null | undefined, fallback?: string | null): string;
}

export function createTranslator(locale: Locale): Translator {
  const dictionary = DICTIONARIES[locale];
  const lookup = (text: string) => dictionary?.[text] ?? text;

  const t = ((text: string, params?: Params) => interpolate(lookup(text), params)) as Translator;
  t.locale = locale;
  t.dir = dirOf(locale);

  t.n = (count, singular, plural = `${singular}s`) => {
    if (!dictionary) return pluralize(count, singular, plural);
    // Other languages translate one counted template, keyed by the English plural.
    const template = dictionary[`{count} ${plural}`];
    return template ? interpolate(template, { count }) : pluralize(count, singular, plural);
  };

  t.date = (date, tz) => formatDate(date, tz, locale);
  t.dateTime = (date, tz) => formatDateTime(date, tz, locale);
  t.deadline = (date, tz, now) => formatDeadline(date, tz, now, locale);
  t.ago = (date, now) => timeAgo(date, now, locale);
  t.greeting = (tz, now) => greeting(tz, now, locale);
  t.money = formatMoney;

  t.msg = (stored, fallback) => {
    if (!stored?.k) return fallback ?? "";
    const params: Record<string, string | number> = {};
    // `t_` values are themselves translatable (status and reason labels); `d_` values are ISO dates.
    for (const [key, value] of Object.entries(stored.p ?? {})) {
      params[key] = key.startsWith("t_") ? lookup(String(value)) : key.startsWith("d_") ? formatDate(new Date(value), undefined, locale) : value;
    }
    return interpolate(lookup(stored.k), params);
  };

  return t;
}
