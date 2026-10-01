import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { cn, initials } from "@/lib/utils";

/* ─── Card ───────────────────────────────────────────────────────────── */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-surface shadow-card", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-line px-4 py-3", className)}>
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ─── Page header ────────────────────────────────────────────────────── */

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium text-muted">{eyebrow}</div>}
        <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────── */

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      {icon && <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-paper text-muted ring-1 ring-line [&_svg]:size-[18px]">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-ink/[0.06]", className)} aria-hidden />;
}

/** Generic page-level loading skeleton used by route `loading.tsx` files. */
export function PageSkeleton({ stats = 4, rows = 6 }: { stats?: number; rows?: number }) {
  return (
    <div role="status" aria-label="Loading">
      <Skeleton className="h-7 w-52" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      {stats > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: stats }, (_, i) => (
            <Skeleton key={i} className="h-[84px] rounded-xl" />
          ))}
        </div>
      )}
      <div className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-0">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-24 sm:block" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Avatar ─────────────────────────────────────────────────────────── */

const avatarHues = ["bg-emerald-100 text-emerald-800", "bg-sky-100 text-sky-800", "bg-violet-100 text-violet-800", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-800", "bg-stone-200 text-stone-700"];

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const sizes = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-10 text-sm" };
  return (
    <span className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold", avatarHues[hash % avatarHues.length], sizes[size], className)} aria-hidden>
      {initials(name)}
    </span>
  );
}

/* ─── Stat tile ──────────────────────────────────────────────────────── */

export function Stat({ label, value, hint, href, tone }: { label: string; value: ReactNode; hint?: ReactNode; href?: string; tone?: "default" | "warn" | "danger" }) {
  const body = (
    <>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums tracking-tight", tone === "danger" && "text-danger", tone === "warn" && "text-amber-700")}>{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-muted">{hint}</p>}
    </>
  );
  const className = "block rounded-xl border border-line bg-surface px-4 py-3.5 shadow-card";
  return href ? (
    <Link href={href} className={cn(className, "transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md active:translate-y-0")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/* ─── Table ──────────────────────────────────────────────────────────── */

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className="responsive-table-wrap scrollbar-thin overflow-x-auto">
      <table className={cn("responsive-table w-full min-w-max border-collapse text-start text-sm", className)}>{children}</table>
    </div>
  );
}

export function Th({ className, children }: { className?: string; children?: ReactNode }) {
  return <th className={cn("border-b border-line bg-paper/60 px-4 py-2.5 text-xs font-medium text-muted first:rounded-ss-xl last:rounded-se-xl", className)}>{children}</th>;
}

/** `label` is the column name; phones show it beside the value when the table stacks into cards. */
export function Td({ className, label, children }: { className?: string; label?: string; children?: ReactNode }) {
  return (
    <td data-label={label} className={cn("border-b border-line px-4 py-3 align-middle [tr:last-child>&]:border-0", className)}>
      {children}
    </td>
  );
}

/* ─── Link tabs (state lives in the URL) ─────────────────────────────── */

export function LinkTabs({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <nav className="scrollbar-thin mb-4 flex gap-1 overflow-x-auto border-b border-line" aria-label="Filters">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            tab.key === active ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count !== undefined && <span className="rounded-full bg-ink/[0.06] px-1.5 text-[11px] tabular-nums text-ink-soft">{tab.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

/* ─── Callout ────────────────────────────────────────────────────────── */

export function Callout({ tone = "info", icon, title, children, action }: { tone?: "info" | "warn" | "danger"; icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  const tones = {
    info: "border-line bg-surface",
    warn: "border-amber-200 bg-amber-50",
    danger: "border-red-200 bg-danger-soft",
  };
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center", tones[tone])}>
      {icon && <div className={cn("shrink-0 [&_svg]:size-[18px]", tone === "danger" ? "text-danger" : tone === "warn" ? "text-amber-700" : "text-muted")}>{icon}</div>}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        {children && <div className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{children}</div>}
      </div>
      {action}
    </div>
  );
}
