import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "../../globals.css";

// The admin is English-only (spec §4) and never indexed.
const latin = Geist({
  variable: "--font-latin",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Menu admin", template: "%s · Menu admin" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="en" dir="ltr" className={`${latin.variable} antialiased`}>
      <body className="bg-muted/40 text-foreground min-h-dvh">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
