"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

const ModalCloseContext = createContext<(() => void) | null>(null);

/** Lets content inside a modal (e.g. a form) close it after a successful action. */
export function useModalClose() {
  return useContext(ModalCloseContext);
}

interface ModalProps {
  /** Element that opens the modal when clicked (usually a Button). */
  trigger: ReactNode;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

export function Modal({ trigger, title, description, size = "md", children }: ModalProps) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      <dialog
        ref={ref}
        onClose={close}
        onClick={(e) => {
          // A click on the dialog element itself is a click on the backdrop.
          if (e.target === ref.current) close();
        }}
        className={cn("w-[calc(100%-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/40", widths[size])}
      >
        {open && (
          <ModalCloseContext.Provider value={close}>
            <div className="flex max-h-[85dvh] flex-col">
              <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold">{title}</h2>
                  {description && <p className="mt-0.5 text-[13px] leading-snug text-muted">{description}</p>}
                </div>
                <button type="button" onClick={close} className="-me-1 rounded-md p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label={t("Close")}>
                  <X className="size-4" />
                </button>
              </header>
              <div className="scrollbar-thin overflow-y-auto px-5 py-4">{children}</div>
            </div>
          </ModalCloseContext.Provider>
        )}
      </dialog>
    </>
  );
}
