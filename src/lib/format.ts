import { intlTag, type Locale } from "@/i18n/config";

export type PersianDigits = "latn" | "arabext";

/** Locale-aware number formatter honouring the restaurant's Persian digit setting. */
function tag(locale: Locale, persianDigits: PersianDigits): string {
  return `${intlTag[locale]}-u-nu-${locale === "fa" ? persianDigits : "latn"}`;
}

export function formatPrice(
  cents: number,
  currency: string,
  locale: Locale,
  persianDigits: PersianDigits = "latn",
): string {
  return new Intl.NumberFormat(tag(locale, persianDigits), {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(cents / 100);
}

export function formatNumber(
  n: number,
  locale: Locale,
  persianDigits: PersianDigits = "latn",
): string {
  return new Intl.NumberFormat(tag(locale, persianDigits)).format(n);
}

/** Accent- and case-insensitive text for client-side search. */
export function normalizeForSearch(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
