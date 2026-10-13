"use client";

import { cn } from "@/lib/utils";

export type EditLocale = "en" | "fa" | "fr";
export const EDIT_LOCALES: { code: EditLocale; label: string; name: string }[] =
  [
    { code: "en", label: "EN", name: "English (required)" },
    { code: "fa", label: "FA", name: "Persian" },
    { code: "fr", label: "FR", name: "French" },
  ];

/** Tab strip for translatable fields. A dot marks a language that still has empty fields. */
export function LanguageTabs({
  value,
  onChange,
  missing,
}: {
  value: EditLocale;
  onChange: (l: EditLocale) => void;
  missing: Partial<Record<EditLocale, boolean>>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Language"
      className="bg-muted/50 inline-flex rounded-xl border p-1"
    >
      {EDIT_LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          role="tab"
          aria-selected={value === l.code}
          aria-label={`${l.name}${missing[l.code] ? " — missing text" : ""}`}
          onClick={() => onChange(l.code)}
          className={cn(
            "relative inline-flex min-h-10 min-w-14 items-center justify-center rounded-lg px-3 text-sm font-medium",
            value === l.code
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l.label}
          {missing[l.code] && (
            <span
              aria-hidden="true"
              className="absolute end-1.5 top-1.5 size-1.5 rounded-full bg-amber-500"
            />
          )}
        </button>
      ))}
    </div>
  );
}

/** Compact "EN FA FR" indicator for list rows; missing languages are shown struck through. */
export function TranslationStatus({
  has,
}: {
  has: Record<"fa" | "fr", boolean>;
}) {
  const missing = (["fa", "fr"] as const).filter((l) => !has[l]);
  return (
    <span
      className="inline-flex gap-1 font-mono text-[11px]"
      title={
        missing.length
          ? `Missing: ${missing.map((l) => l.toUpperCase()).join(", ")}`
          : "All languages done"
      }
    >
      <span>EN</span>
      {(["fa", "fr"] as const).map((l) => (
        <span
          key={l}
          className={has[l] ? "" : "text-muted-foreground line-through"}
        >
          {l.toUpperCase()}
        </span>
      ))}
      {missing.length > 0 && (
        <span className="sr-only">{`Missing ${missing.map((l) => l.toUpperCase()).join(" and ")}`}</span>
      )}
    </span>
  );
}

export const inputDir = (l: EditLocale) => (l === "fa" ? "rtl" : "ltr");
