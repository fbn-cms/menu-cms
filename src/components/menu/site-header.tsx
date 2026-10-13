import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/t";
import { imageUrl } from "@/lib/menu/image";
import type { Menu } from "@/lib/menu/types";
import { readTheme } from "@/lib/theme";
import { LanguageSwitcher } from "./language-switcher";

const LOGO_HEIGHT = 40;

export function SiteHeader({
  restaurant,
  locale,
  messages,
}: {
  restaurant: Menu["restaurant"];
  locale: Locale;
  messages: Messages;
}) {
  const theme = readTheme(restaurant.theme);
  const logo = restaurant.logo_key;
  // Reserve the logo's exact box from its stored size (no layout shift; logo is never mirrored).
  const logoWidth =
    logo && theme.logoWidth && theme.logoHeight
      ? Math.round((LOGO_HEIGHT * theme.logoWidth) / theme.logoHeight)
      : undefined;
  return (
    <header className="px-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/${locale}/menu`}
          className="flex min-h-11 min-w-0 items-center gap-3"
        >
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- next/image needs sharp, unavailable on Workers (spec §2)
            <img
              src={imageUrl(logo)}
              alt={theme.showName ? "" : restaurant.name}
              width={logoWidth}
              height={LOGO_HEIGHT}
              fetchPriority="high"
              className="h-10 w-auto max-w-[60vw] object-contain"
            />
          )}
          {(theme.showName || !logo) && (
            <span className="truncate text-2xl font-semibold tracking-tight">
              {restaurant.name}
            </span>
          )}
        </Link>
        <LanguageSwitcher current={locale} label={messages.language} />
      </div>
      {restaurant.banner_message && (
        <p role="note" className="bg-muted mt-3 rounded-xl px-4 py-3 text-sm">
          {restaurant.banner_message}
        </p>
      )}
    </header>
  );
}
