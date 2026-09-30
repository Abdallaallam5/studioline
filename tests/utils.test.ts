import { describe, expect, it } from "vitest";
import { addMonthsUtc, dayKey, dayRange, parseLocalDate, parseLocalDateTime, toDateTimeInputValue, utcMonthRange, zonedTimeToUtc } from "@/lib/dates";
import { extensionOf, isAllowedFile } from "@/lib/storage/rules";
import { formatMoney, parseMoneyToCents } from "@/lib/utils";
import { normalizePhone, whatsappLink } from "@/lib/whatsapp";

describe("timezone helpers", () => {
  it("converts wall-clock time to UTC", () => {
    expect(zonedTimeToUtc(2026, 1, 15, 9, 0, "Asia/Dubai").toISOString()).toBe("2026-01-15T05:00:00.000Z");
    expect(zonedTimeToUtc(2026, 1, 15, 9, 0, "America/New_York").toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });

  it("handles daylight saving time", () => {
    expect(zonedTimeToUtc(2026, 7, 15, 9, 0, "America/New_York").toISOString()).toBe("2026-07-15T13:00:00.000Z");
    expect(zonedTimeToUtc(2026, 7, 15, 9, 0, "Europe/London").toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });

  it("round-trips datetime-local values", () => {
    const parsed = parseLocalDateTime("2026-06-10T16:30", "Africa/Cairo")!;
    expect(toDateTimeInputValue(parsed, "Africa/Cairo")).toBe("2026-06-10T16:30");
    expect(parseLocalDateTime("not a date", "UTC")).toBeNull();
  });

  it("finds the local day for an instant", () => {
    // 22:30 UTC on the 10th is already the 11th in Dubai.
    const instant = new Date("2026-06-10T22:30:00Z");
    expect(dayKey(instant, "Asia/Dubai")).toBe("2026-06-11");
    expect(dayKey(instant, "UTC")).toBe("2026-06-10");
    const { start, end } = dayRange("Asia/Dubai", instant);
    expect(start.toISOString()).toBe("2026-06-10T20:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-11T20:00:00.000Z");
  });

  it("parses date inputs as local midnight", () => {
    expect(parseLocalDate("2026-03-01", "UTC")!.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(parseLocalDate("03/01/2026", "UTC")).toBeNull();
  });

  it("adds months without overflowing short months", () => {
    expect(addMonthsUtc(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(addMonthsUtc(new Date("2026-12-15T00:00:00Z"), 1).toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });

  it("computes calendar month ranges", () => {
    const base = new Date("2026-01-20T10:00:00Z");
    expect(utcMonthRange(base).start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(utcMonthRange(base).end.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(utcMonthRange(base, -1).start.toISOString()).toBe("2025-12-01T00:00:00.000Z");
  });
});

describe("money", () => {
  it("parses decimal amounts into cents", () => {
    expect(parseMoneyToCents("49")).toBe(4900);
    expect(parseMoneyToCents("49.5")).toBe(4950);
    expect(parseMoneyToCents("1,200.05")).toBe(120005);
    expect(parseMoneyToCents("0")).toBe(0);
  });

  it("rejects anything that is not a plain amount", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1e3", "$10"]) expect(parseMoneyToCents(bad)).toBeNull();
  });

  it("formats cents", () => {
    expect(formatMoney(4900, "USD")).toBe("$49");
    expect(formatMoney(4950, "USD")).toBe("$49.50");
  });
});

describe("whatsapp", () => {
  it("normalises phone numbers", () => {
    expect(normalizePhone("+971 50 123 4567")).toBe("+971501234567");
    expect(normalizePhone("00 44 7700 900123")).toBe("+447700900123");
    expect(normalizePhone("12345")).toBeNull();
  });

  it("builds click-to-chat links", () => {
    expect(whatsappLink("+971 50 123 4567", "Hi there")).toBe("https://wa.me/971501234567?text=Hi%20there");
    expect(whatsappLink(null, "Hi")).toBeNull();
  });
});

describe("upload rules", () => {
  it("allows common work files and blocks executables and markup", () => {
    expect(isAllowedFile("Brief.PDF")).toBe(true);
    expect(isAllowedFile("hero.final.png")).toBe(true);
    expect(isAllowedFile("reel.mp4")).toBe(true);
    for (const bad of ["run.exe", "page.html", "logo.svg", "script.js", "noextension"]) expect(isAllowedFile(bad)).toBe(false);
    expect(extensionOf("archive.tar.ZIP")).toBe("zip");
  });
});
