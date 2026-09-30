import { Logo } from "@/components/layout/logo";
import { LanguageToggle } from "@/lib/i18n/client";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center px-4 py-10 sm:py-16">
      <LanguageToggle className="absolute end-4 top-4" />
      <Logo />
      <main className="mt-8 w-full max-w-md">{children}</main>
    </div>
  );
}
