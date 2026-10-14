import { cn } from "@/lib/utils";
import { cardsAreDark, deriveTheme, isDark, readTheme } from "@/lib/theme";

/**
 * Applies the owner's colours to the public menu. Values come from readTheme(), which only lets
 * through #rrggbb hex colours, so nothing from the database can inject CSS.
 * Dark backgrounds also switch on the `dark:` variants (badges etc.) for readable contrast.
 * A background pattern switches on the `ornate:` layout variants (data-ornate).
 */
export function RestaurantTheme({
  theme,
  children,
}: {
  theme: unknown;
  children: React.ReactNode;
}) {
  const t = readTheme(theme);
  const css = Object.entries(deriveTheme(t))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return (
    <>
      {/* Also targets .dark: shadcn's .dark block redefines these variables on the wrapper. */}
      <style>{`:root,:root .dark{${css}}:root{color-scheme:${isDark(t.background) ? "dark" : "light"}}`}</style>
      {/* The menu column is solid; on wide screens the patterned page shows only beside it. */}
      <div
        data-ornate={t.pattern ? "" : undefined}
        className={cn(
          "bg-background min-h-dvh",
          t.pattern && "sm:shadow-[0_0_48px_rgb(0_0_0/0.45)]",
          cardsAreDark(t) && "dark",
        )}
      >
        {children}
      </div>
    </>
  );
}
