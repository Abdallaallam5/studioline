import type { ReactNode } from "react";

export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children?: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
      {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
    </>
  );
}
