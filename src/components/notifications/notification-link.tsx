"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { markNotificationRead } from "@/server/actions/workspace";

/** Opens the notification's target and marks it read on the way. */
export function NotificationLink({ id, href, unread, className, children }: { id: string; href: string | null; unread: boolean; className?: string; children: ReactNode }) {
  function markRead() {
    if (!unread) return;
    const formData = new FormData();
    formData.set("notificationId", id);
    void markNotificationRead(formData);
  }

  if (!href) {
    return (
      <button type="button" onClick={markRead} className={className}>
        {children}
      </button>
    );
  }
  return (
    <Link href={href} onClick={markRead} className={className}>
      {children}
    </Link>
  );
}
