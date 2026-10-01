"use client";

import { Check, CheckCircle2, CircleAlert, Copy, MessageCircle, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import { cn, type ShareLink } from "@/lib/utils";
import { buttonClass } from "./button";

type ToastItem = { id: number; kind: "success" | "error"; message: string; share?: ShareLink };

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function push(kind: ToastItem["kind"], message: string, share?: ShareLink) {
  const id = nextId++;
  items = [...items.slice(-2), { id, kind, message, share }];
  emit();
  // A link that has to be passed on stays until it is dismissed.
  if (!share) setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4500);
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  /** Success message with a one-time link to copy or send on WhatsApp. */
  share: (message: string, share: ShareLink) => push("success", message, share),
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const EMPTY: ToastItem[] = [];

function SharePanel({ share }: { share: ShareLink }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the link stays selectable in the field.
    }
  }

  return (
    <div className="mt-2.5 space-y-2">
      <input
        readOnly
        dir="ltr"
        value={share.url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label={t("Link")}
        className="h-8 w-full rounded-md border border-line bg-paper px-2 font-mono text-[11px] text-ink-soft"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={buttonClass({ size: "sm", variant: "secondary" })}>
          {copied ? <Check /> : <Copy />}
          {copied ? t("Copied") : t("Copy link")}
        </button>
        {share.whatsapp && (
          <a href={share.whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClass({ size: "sm" })}>
            <MessageCircle /> {t("Send on WhatsApp")}
          </a>
        )}
      </div>
    </div>
  );
}

export function Toaster() {
  const t = useT();
  const toasts = useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end" aria-live="polite">
      {toasts.map((item) => (
        <div
          key={item.id}
          role={item.kind === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-2.5 rounded-xl border bg-surface px-3.5 py-3 text-sm shadow-pop",
            item.kind === "error" ? "border-red-200" : "border-line",
          )}
        >
          {item.kind === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />}
          <div className="min-w-0 flex-1">
            <p className="leading-snug text-ink">{item.message}</p>
            {item.share && <SharePanel share={item.share} />}
          </div>
          <button type="button" onClick={() => dismiss(item.id)} className="rounded p-0.5 text-muted hover:text-ink" aria-label={t("Dismiss")}>
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
