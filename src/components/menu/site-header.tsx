import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/t";
import type { Menu } from "@/lib/menu/types";
import { LanguageSwitcher } from "./language-switcher";

export function SiteHeader({
  restaurant,
  locale,
  messages,
}: {
  restaurant: Menu["restaurant"];
  locale: Locale;
  messages: Messages;
}) {
  return (
    <header className="px-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/${locale}/menu`}
          className="text-2xl font-semibold tracking-tight"
        >
          {restaurant.name}
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
