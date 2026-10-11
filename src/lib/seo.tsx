import type { Metadata } from "next";
import { locales, type Locale } from "@/i18n/config";
import { absoluteUrl } from "@/lib/env";

/** Canonical + hreflang alternates for a path that exists in every locale ("/menu", "/item/x"). */
export function localeAlternates(
  locale: Locale,
  pathWithoutLocale: string,
): Metadata["alternates"] {
  return {
    canonical: absoluteUrl(`/${locale}${pathWithoutLocale}`),
    languages: {
      ...Object.fromEntries(
        locales.map((l) => [l, absoluteUrl(`/${l}${pathWithoutLocale}`)]),
      ),
      "x-default": absoluteUrl(`/en${pathWithoutLocale}`),
    },
  };
}

export function JsonLd({ data }: { data: object }) {
  // Data block, not executable script: not subject to script-src CSP.
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
