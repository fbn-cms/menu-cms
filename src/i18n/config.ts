export const locales = ["en", "fa", "fr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const isLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);

export const localeDir = (locale: Locale): "ltr" | "rtl" =>
  locale === "fa" ? "rtl" : "ltr";

/** BCP-47 tags for Intl formatting. */
export const intlTag: Record<Locale, string> = {
  en: "en-CA",
  fa: "fa-IR",
  fr: "fr-CA",
};

/** Each language named in itself, for the switcher. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  fa: "فارسی",
  fr: "Français",
};

/** Key used to remember the diner's explicit language choice (localStorage, not a cookie). */
export const LOCALE_STORAGE_KEY = "menu.locale";

/** Pick the best supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag = "", q] = part.trim().split(";q=");
      return {
        lang: tag.toLowerCase().split("-")[0] ?? "",
        q: q ? Number(q) : 1,
      };
    })
    .sort((a, b) => b.q - a.q);
  for (const { lang } of ranked) {
    if (lang === "fa" || lang === "per") return "fa";
    if (isLocale(lang)) return lang;
  }
  return defaultLocale;
}

/** Replace the locale segment of a pathname, preserving the rest. */
export function swapLocale(pathname: string, locale: Locale): string {
  const parts = pathname.split("/");
  if (parts[1] && isLocale(parts[1])) parts[1] = locale;
  else parts.splice(1, 0, locale);
  return parts.join("/") || `/${locale}`;
}
