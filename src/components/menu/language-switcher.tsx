"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Languages } from "lucide-react";
import {
  LOCALE_STORAGE_KEY,
  localeNames,
  locales,
  swapLocale,
  type Locale,
} from "@/i18n/config";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
  current,
  label,
}: {
  current: Locale;
  label: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex items-center gap-1">
      <Languages aria-hidden="true" className="text-muted-foreground size-4" />
      {locales.map((locale) => (
        <Link
          key={locale}
          href={swapLocale(pathname, locale)}
          hrefLang={locale}
          lang={locale}
          aria-current={locale === current ? "true" : undefined}
          onClick={() => {
            try {
              localStorage.setItem(LOCALE_STORAGE_KEY, locale);
            } catch {
              // storage disabled (private mode) — the URL still carries the choice
            }
          }}
          className={cn(
            "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-sm",
            locale === current
              ? "bg-foreground text-background font-medium"
              : "hover:bg-muted",
          )}
        >
          {localeNames[locale]}
        </Link>
      ))}
    </nav>
  );
}
