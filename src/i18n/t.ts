import type { Locale } from "./config";
import { en, type Messages } from "./messages/en";
import { fa } from "./messages/fa";
import { fr } from "./messages/fr";

const all: Record<Locale, Messages> = { en, fa, fr };

export const getMessages = (locale: Locale): Messages => all[locale];

/** Fill `{name}` placeholders. */
export function t(
  template: string,
  vars: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(vars[key] ?? `{${key}}`),
  );
}

export type { Messages };
