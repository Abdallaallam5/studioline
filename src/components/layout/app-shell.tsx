"use client";

import { Bell, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { LanguageToggle, useT } from "@/lib/i18n/client";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Match only the exact path (for section roots like /workspace). */
  exact?: boolean;
  badge?: number;
}

interface AppShellProps {
  homeHref: string;
  nav: NavItem[];
  /** Optional second group, rendered below a divider. */
  secondaryNav?: NavItem[];
  user: { name: string; email: string };
  /** Small label under the logo: workspace name or "Platform owner". */
  contextLabel: string;
  notificationsHref?: string;
  unreadCount?: number;
  logoutAction: () => Promise<void>;
  banner?: ReactNode;
  children: ReactNode;
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
        active ? "bg-ink/[0.06] text-ink" : "text-ink-soft hover:bg-ink/[0.04] hover:text-ink",
      )}
    >
      <span className={active ? "text-brand" : "text-muted group-hover:text-ink-soft"}>{item.icon}</span>
      <span className="flex-1 truncate">{item.label}</span>
      {!!item.badge && (
        <span className="rounded-full bg-brand px-1.5 py-px text-[11px] font-semibold tabular-nums text-white">{item.badge > 99 ? "99+" : item.badge}</span>
      )}
    </Link>
  );
}

export function AppShell({ homeHref, nav, secondaryNav, user, contextLabel, notificationsHref, unreadCount = 0, logoutAction, banner, children }: AppShellProps) {
  const t = useT();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer on Escape and lock page scroll while it is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Logo href={homeHref} />
      </div>
      <p className="truncate px-4 pb-3 text-xs text-muted" title={contextLabel}>
        {contextLabel}
      </p>
      <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-2 pb-4" aria-label={t("Main")}>
        {nav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
        {secondaryNav && secondaryNav.length > 0 && (
          <>
            <div className="mx-2.5 my-3 border-t border-line" />
            {secondaryNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </>
        )}
      </nav>
      <div className="border-t border-line p-2">
        <LanguageToggle className="mb-1 w-full justify-start" />
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-tight">{user.name}</p>
            <p className="truncate text-xs leading-tight text-muted">{user.email}</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="rounded-md p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label={t("Sign out")} title={t("Sign out")}>
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:ps-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 border-e border-line bg-surface lg:block">{sidebar()}</aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur lg:hidden">
        <button type="button" onClick={() => setDrawerOpen(true)} className="rounded-lg p-2 text-ink-soft hover:bg-ink/5" aria-label={t("Open menu")}>
          <Menu className="size-5" />
        </button>
        <Logo href={homeHref} />
        <div className="flex-1" />
        {notificationsHref && (
          <Link href={notificationsHref} className="relative rounded-lg p-2 text-ink-soft hover:bg-ink/5" aria-label={unreadCount ? t("Notifications ({count} unread)", { count: unreadCount }) : t("Notifications")}>
            <Bell className="size-5" />
            {unreadCount > 0 && <span className="absolute end-1.5 top-1.5 size-2 rounded-full bg-brand ring-2 ring-surface" />}
          </Link>
        )}
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t("Menu")}>
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 max-w-[85vw] bg-surface shadow-pop">
            <button type="button" onClick={() => setDrawerOpen(false)} className="absolute end-2 top-3 rounded-lg p-2 text-muted hover:bg-ink/5" aria-label={t("Close menu")}>
              <X className="size-4" />
            </button>
            {sidebar(() => setDrawerOpen(false))}
          </aside>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {banner && <div className="mb-6">{banner}</div>}
        {children}
      </main>
    </div>
  );
}
