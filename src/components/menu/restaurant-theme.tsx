import { deriveTheme, isDark, readTheme } from "@/lib/theme";

/**
 * Applies the owner's colours to the public menu. Values come from readTheme(), which only lets
 * through #rrggbb hex colours, so nothing from the database can inject CSS.
 * Dark backgrounds also switch on the `dark:` variants (badges etc.) for readable contrast.
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
      <div className={isDark(t.background) ? "dark" : undefined}>
        {children}
      </div>
    </>
  );
}
