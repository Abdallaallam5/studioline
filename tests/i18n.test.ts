import { describe, expect, it } from "vitest";
import { ar } from "@/lib/i18n/ar";
import { dirOf, interpolate, msg, renderEnglish } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translator";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("Arabic dictionary", () => {
  it("keeps every placeholder of the English source", () => {
    const broken = Object.entries(ar).filter(([source, translation]) => placeholders(source).join() !== placeholders(translation).join());
    expect(broken.map(([source]) => source)).toEqual([]);
  });

  it("has no empty translations", () => {
    expect(Object.entries(ar).filter(([, value]) => !value.trim())).toEqual([]);
  });
});

describe("translator", () => {
  const en = createTranslator("en");
  const arabic = createTranslator("ar");

  it("returns the source text in English and the translation in Arabic", () => {
    expect(en("Save changes")).toBe("Save changes");
    expect(arabic("Save changes")).toBe("حفظ التغييرات");
  });

  it("falls back to English for unknown strings", () => {
    expect(arabic("A string nobody translated")).toBe("A string nobody translated");
  });

  it("interpolates parameters in both languages", () => {
    expect(en("Edit {name}", { name: "Lina" })).toBe("Edit Lina");
    expect(arabic("Edit {name}", { name: "Lina" })).toBe("تعديل Lina");
    expect(interpolate("{a} and {missing}", { a: 1 })).toBe("1 and {missing}");
  });

  it("counts nouns", () => {
    expect(en.n(1, "task")).toBe("1 task");
    expect(en.n(3, "task")).toBe("3 tasks");
    expect(arabic.n(3, "task")).toBe("3 مهمة");
  });

  it("sets the text direction", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("en")).toBe("ltr");
    expect(arabic.dir).toBe("rtl");
  });

  it("renders stored messages in the reader's language", () => {
    const stored = msg('Moved "{title}" to {t_status}', { title: "Banner", t_status: "In progress" });
    expect(renderEnglish(stored)).toBe('Moved "Banner" to In progress');
    expect(en.msg(stored)).toBe('Moved "Banner" to In progress');
    expect(arabic.msg(stored)).toBe("نقل «Banner» إلى: قيد التنفيذ");
  });

  it("formats stored dates for the reader's locale", () => {
    const stored = msg("Next renewal: {d_date}.", { d_date: "2026-10-30T00:00:00.000Z" });
    expect(renderEnglish(stored)).toBe("Next renewal: 30 Oct 2026.");
    expect(arabic.msg(stored)).toContain("أكتوبر");
  });

  it("uses the plain text when no template was stored", () => {
    expect(arabic.msg(null, "A comment excerpt")).toBe("A comment excerpt");
  });
});
