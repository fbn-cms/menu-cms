import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/t";
import { imageUrl } from "@/lib/menu/image";
import type { Menu } from "@/lib/menu/types";
import { readTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { HeaderShell } from "./header-shell";
import { LanguageSwitcher } from "./language-switcher";

const LOGO_HEIGHT = 48;

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
  // Reserve the logo's exact box from its stored size (no layout shift; logos are never mirrored).
  const logoWidth =
    logo && theme.logoWidth && theme.logoHeight
      ? Math.round((LOGO_HEIGHT * theme.logoWidth) / theme.logoHeight)
      : undefined;
  const ornate = theme.pattern != null;
  return (
    <header
      className={cn("surface-chrome", ornate ? "pb-2" : "px-4 pt-2 pb-1")}
    >
      <HeaderShell
        ornate={ornate}
        staffLabel={messages.staffLogin}
        switcher={
          <LanguageSwitcher current={locale} label={messages.language} />
        }
        brand={
          <>
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element -- next/image needs sharp, unavailable on Workers (spec §2)
              <img
                src={imageUrl(logo)}
                alt={theme.showName ? "" : restaurant.name}
                width={logoWidth}
                height={LOGO_HEIGHT}
                fetchPriority="high"
                draggable={false}
                className="h-12 w-auto max-w-[70vw] object-contain"
              />
            )}
            {(theme.showName || !logo) && (
              <p
                className={cn(
                  "truncate text-2xl font-semibold tracking-tight",
                  ornate &&
                    "font-display max-w-full text-[1.75rem] leading-tight tracking-normal whitespace-normal",
                )}
              >
                {restaurant.name}
              </p>
            )}
          </>
        }
      />
      {restaurant.banner_message && (
        <p
          role="note"
          className={cn(
            "bg-muted mt-3 rounded-xl px-4 py-3 text-sm",
            ornate && "mx-4 text-center",
          )}
        >
          {restaurant.banner_message}
        </p>
      )}
    </header>
  );
}
