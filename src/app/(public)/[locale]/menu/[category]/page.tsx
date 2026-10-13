import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RestaurantTheme } from "@/components/menu/restaurant-theme";
import { MenuView } from "@/components/menu/menu-view";
import { SiteHeader } from "@/components/menu/site-header";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/t";
import { getMenu } from "@/lib/menu/fetch";
import { localeAlternates } from "@/lib/seo";

export const revalidate = 600;

export function generateStaticParams() {
  return []; // render each category on first visit, then cache
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/menu/[category]">): Promise<Metadata> {
  const { locale, category } = await params;
  if (!isLocale(locale)) return {};
  const menu = await getMenu(locale);
  const cat = menu?.categories.find((c) => c.slug === category);
  if (!menu || !cat) return {};
  return {
    title: `${cat.name} — ${menu.restaurant.name}`,
    description: cat.description ?? cat.items.map((i) => i.name).join(" · "),
    alternates: localeAlternates(locale, `/menu/${category}`),
  };
}

export default async function CategoryPage({
  params,
}: PageProps<"/[locale]/menu/[category]">) {
  const { locale, category } = await params;
  if (!isLocale(locale)) notFound();
  const menu = await getMenu(locale);
  const cat = menu?.categories.find((c) => c.slug === category);
  if (!menu || !cat) notFound();
  const messages = getMessages(locale);
  return (
    <RestaurantTheme theme={menu.restaurant.theme}>
      <SiteHeader
        restaurant={menu.restaurant}
        locale={locale}
        messages={messages}
      />
      <main>
        <h1 className="sr-only">{cat.name}</h1>
        <MenuView
          menu={menu}
          locale={locale}
          messages={messages}
          categorySlug={category}
        />
      </main>
    </RestaurantTheme>
  );
}
