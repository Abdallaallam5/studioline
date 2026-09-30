import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Wordmark: three stacked lines, the middle one offset — a task list in motion. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <rect width="24" height="24" rx="6.5" fill="var(--color-brand)" />
      <path d="M7 8.25h7.5M9.5 12h7.5M7 15.75h5" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink", className)}>
      <LogoMark />
      {BRAND.name}
    </Link>
  );
}
