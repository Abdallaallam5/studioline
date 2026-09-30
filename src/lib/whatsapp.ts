/**
 * WhatsApp click-to-chat links. These open WhatsApp with a pre-filled message;
 * the sender still presses send, so no WhatsApp Business API is required.
 */

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  const normalized = digits.replace(/^00/, "");
  // International numbers never start with 0; a leading 0 means the country code is missing.
  if (normalized.length < 7 || normalized.length > 15 || normalized.startsWith("0")) return null;
  return `+${normalized}`;
}

export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized.slice(1)}?text=${encodeURIComponent(message)}`;
}

type T = (text: string, params?: Record<string, string | number>) => string;

/** Pre-filled messages, written in the sender's interface language via `t`. */
export const whatsappMessages = {
  taskAssigned: (t: T, p: { employeeName: string; title: string; deadline: string; url: string }) =>
    t('Hi {employeeName}, you have a new task: "{title}".\nDeadline: {deadline}\n{url}', p),
  taskReminder: (t: T, p: { employeeName: string; title: string; deadline: string; url: string }) =>
    t('Hi {employeeName}, a reminder about "{title}".\nDeadline: {deadline}\n{url}', p),
  changesRequested: (t: T, p: { employeeName: string; title: string; url: string }) =>
    t('Hi {employeeName}, I\'ve requested changes on "{title}". Details here:\n{url}', p),
  askManager: (t: T, p: { managerName: string; title: string; url: string }) => t('Hi {managerName}, I have a question about "{title}":\n{url}', p),
};
