import "server-only";
import { renderEnglish, type StoredMessage } from "@/lib/i18n/config";
import { Notification } from "@/models";

export interface NotifyInput {
  userId: string;
  workspaceId?: string | null;
  type: string;
  /** A translatable message (preferred) or plain text such as a comment excerpt. */
  title: string | StoredMessage;
  body?: string | StoredMessage | null;
  href?: string | null;
}

const text = (value: string | StoredMessage) => (typeof value === "string" ? value : renderEnglish(value));

/** Create an in-app notification. Failures are logged, never thrown. */
export async function notify(input: NotifyInput | NotifyInput[]): Promise<void> {
  const items = Array.isArray(input) ? input : [input];
  if (items.length === 0) return;
  try {
    await Notification.insertMany(
      items.map((n) => ({
        userId: n.userId,
        workspaceId: n.workspaceId ?? null,
        type: n.type,
        title: text(n.title).slice(0, 200),
        titleT: typeof n.title === "string" ? null : n.title,
        body: n.body ? text(n.body).slice(0, 500) : null,
        bodyT: n.body && typeof n.body !== "string" ? n.body : null,
        href: n.href ?? null,
      })),
    );
  } catch (err) {
    console.error("[notifications] failed to create notification:", err);
  }
}

export async function unreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ userId, readAt: null });
}
