/**
 * Timezone-aware date helpers built on Intl, so "today" and deadlines follow the
 * workspace's timezone rather than the server's.
 */

import { intlLocale, type Locale } from "@/lib/i18n/config";

export const DEFAULT_TIMEZONE = "UTC";
const DAY_MS = 86_400_000;

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

export function zonedParts(date: Date, tz: string): Parts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(date)) if (p.type !== "literal") map[p.type] = Number(p.value);
  return { year: map.year, month: map.month, day: map.day, hour: map.hour, minute: map.minute, second: map.second };
}

function offsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Convert a wall-clock time in `tz` to the UTC instant it represents. */
export function zonedTimeToUtc(year: number, month: number, day: number, hour = 0, minute = 0, tz = DEFAULT_TIMEZONE): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let utc = guess - offsetMs(new Date(guess), tz);
  utc = guess - offsetMs(new Date(utc), tz); // second pass settles DST edges
  return new Date(utc);
}

/** [start, end) of the calendar day in `tz` that contains `base`, shifted by `offsetDays`. */
export function dayRange(tz: string, base: Date = new Date(), offsetDays = 0): { start: Date; end: Date } {
  const p = zonedParts(base, tz);
  const start = zonedTimeToUtc(p.year, p.month, p.day + offsetDays, 0, 0, tz);
  const end = zonedTimeToUtc(p.year, p.month, p.day + offsetDays + 1, 0, 0, tz);
  return { start, end };
}

/** Parse the value of an `<input type="datetime-local">` as a time in `tz`. */
export function parseLocalDateTime(value: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const d = zonedTimeToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], tz);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse the value of an `<input type="date">` as midnight in `tz`. */
export function parseLocalDate(value: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = zonedTimeToUtc(+m[1], +m[2], +m[3], 0, 0, tz);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateTimeInputValue(date: Date | null | undefined, tz: string): string {
  if (!date) return "";
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function toDateInputValue(date: Date | null | undefined, tz: string): string {
  if (!date) return "";
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "YYYY-MM-DD" key of the day in `tz`; handy for grouping tasks on a calendar. */
export function dayKey(date: Date, tz: string): string {
  return toDateInputValue(date, tz);
}

/** Words used by the formatters below, per interface language. */
const WORDS: Record<Locale, { today: string; tomorrow: string; yesterday: string; noDeadline: string; justNow: string; minutes: string; hours: string; days: string; morning: string; afternoon: string; evening: string }> = {
  en: { today: "Today", tomorrow: "Tomorrow", yesterday: "Yesterday", noDeadline: "No deadline", justNow: "just now", minutes: "{n}m ago", hours: "{n}h ago", days: "{n}d ago", morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" },
  ar: { today: "اليوم", tomorrow: "غداً", yesterday: "أمس", noDeadline: "بدون موعد", justNow: "الآن", minutes: "منذ {n} د", hours: "منذ {n} س", days: "منذ {n} يوم", morning: "صباح الخير", afternoon: "مساء الخير", evening: "مساء الخير" },
};

export function formatDate(date: Date | null | undefined, tz: string = DEFAULT_TIMEZONE, locale: Locale = "en"): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: tz, day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function formatDateTime(date: Date | null | undefined, tz: string = DEFAULT_TIMEZONE, locale: Locale = "en"): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: tz,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** Compact deadline label: "Today 17:00", "Tomorrow 09:30", "Mon 14 Oct". */
export function formatDeadline(date: Date | null | undefined, tz: string, now: Date = new Date(), locale: Locale = "en"): string {
  const words = WORDS[locale];
  if (!date) return words.noDeadline;
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  const key = dayKey(date, tz);
  if (key === dayKey(now, tz)) return `${words.today} ${time}`;
  if (key === dayKey(new Date(now.getTime() + DAY_MS), tz)) return `${words.tomorrow} ${time}`;
  if (key === dayKey(new Date(now.getTime() - DAY_MS), tz)) return `${words.yesterday} ${time}`;
  const sameYear = zonedParts(date, tz).year === zonedParts(now, tz).year;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

export function timeAgo(date: Date, now: Date = new Date(), locale: Locale = "en"): string {
  const words = WORDS[locale];
  const s = Math.round((now.getTime() - date.getTime()) / 1000);
  if (s < 60) return words.justNow;
  const m = Math.round(s / 60);
  if (m < 60) return words.minutes.replace("{n}", String(m));
  const h = Math.round(m / 60);
  if (h < 24) return words.hours.replace("{n}", String(h));
  const d = Math.round(h / 24);
  if (d < 30) return words.days.replace("{n}", String(d));
  return formatDate(date, DEFAULT_TIMEZONE, locale);
}

export function greeting(tz: string, now: Date = new Date(), locale: Locale = "en"): string {
  const words = WORDS[locale];
  const { hour } = zonedParts(now, tz);
  if (hour < 12) return words.morning;
  if (hour < 18) return words.afternoon;
  return words.evening;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Add calendar months in UTC, clamping to the last day of shorter months. */
export function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** [start, end) of the UTC month containing `base`, shifted by `offsetMonths`. */
export function utcMonthRange(base: Date = new Date(), offsetMonths = 0): { start: Date; end: Date } {
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offsetMonths, 1));
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offsetMonths + 1, 1));
  return { start, end };
}

export const COMMON_TIMEZONES = [
  "UTC",
  "Africa/Cairo",
  "Africa/Casablanca",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Sao_Paulo",
  "America/Toronto",
  "Asia/Amman",
  "Asia/Baghdad",
  "Asia/Beirut",
  "Asia/Dubai",
  "Asia/Jakarta",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kuwait",
  "Asia/Qatar",
  "Asia/Riyadh",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Berlin",
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Rome",
] as const;
