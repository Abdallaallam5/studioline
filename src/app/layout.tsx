import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import { BRAND } from "@/lib/brand";
import { I18nProvider } from "@/lib/i18n/client";
import { dirOf } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Geist has no Arabic glyphs; the browser falls back to this face for Arabic text.
const arabic = IBM_Plex_Sans_Arabic({ variable: "--font-arabic", subsets: ["arabic"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description:
    "Plan projects, assign tasks, track deadlines and review work in one calm workspace built for marketing agencies and in-house teams.",
};

export const viewport: Viewport = {
  themeColor: "#f8f7f4",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} dir={dirOf(locale)} className={`${geistSans.variable} ${geistMono.variable} ${arabic.variable}`}>
      <body className="min-h-dvh">
        <I18nProvider locale={locale}>
          {children}
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
