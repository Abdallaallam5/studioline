import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink shadow-card transition-colors placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-paper disabled:text-muted group-data-[invalid=true]/field:border-danger";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-9", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(control, "min-h-20 resize-y py-2 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "select-chevron h-9", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] font-medium text-ink", className)} {...props} />;
}

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={cn("size-4 shrink-0 rounded border-line-strong accent-brand", className)} {...props} />;
}
