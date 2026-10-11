import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Geist, Vazirmatn } from "next/font/google";
import { isLocale, localeDir, locales } from "@/i18n/config";
import { getMessages } from "@/i18n/t";
import { publicEnv } from "@/lib/env";
import "../../globals.css";

// next/font downloads at build time and serves the files from our own origin (no CDN hotlink).
// Vazirmatn (SIL OFL 1.1) covers Persian; only fetched on pages that use it.
const latin = Geist({
  variable: "--font-latin",
  subsets: ["latin"],
  display: "swap",
});
const persian = Vazirmatn({
  variable: "--font-persian",
  subsets: ["arabic", "latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Pages render on first request, then are cached (ISR) and revalidated on demand.
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  return (
    <html
      lang={locale}
      dir={localeDir(locale)}
      className={`${latin.variable} ${persian.variable} antialiased`}
      data-locale={locale}
    >
      <body className="bg-background text-foreground min-h-dvh">
        <a
          href="#menu"
          className="focus:bg-background sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-lg focus:p-3"
        >
          {messages.skipToMenu}
        </a>
        <div className="mx-auto max-w-2xl">{children}</div>
      </body>
    </html>
  );
}
