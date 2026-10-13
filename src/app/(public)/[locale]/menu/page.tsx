import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RestaurantTheme } from "@/components/menu/restaurant-theme";
import { SiteFooter } from "@/components/menu/site-footer";
import { LocalePreference } from "@/components/menu/locale-preference";
import { MenuView } from "@/components/menu/menu-view";
import { SiteHeader } from "@/components/menu/site-header";
import { isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/t";
import { absoluteUrl } from "@/lib/env";
import { getMenu } from "@/lib/menu/fetch";
import type { Menu } from "@/lib/menu/types";
import { JsonLd, localeAlternates } from "@/lib/seo";

export const revalidate = 600;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/menu">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const menu = await getMenu(locale);
  if (!menu) return {};
  const title = `${menu.restaurant.name} — ${getMessages(locale).menu}`;
  const description = menu.categories.map((c) => c.name).join(" · ");
  return {
    title,
    description,
    alternates: localeAlternates(locale, "/menu"),
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/${locale}/menu`),
      siteName: menu.restaurant.name,
      locale,
      type: "website",
    },
  };
}

export default async function MenuPage({
  params,
}: PageProps<"/[locale]/menu">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const menu = await getMenu(locale);
  if (!menu) notFound();
  const messages = getMessages(locale);
  return (
    <RestaurantTheme theme={menu.restaurant.theme}>
      <LocalePreference current={locale} />
      <SiteHeader
        restaurant={menu.restaurant}
        locale={locale}
        messages={messages}
      />
      <main>
        <h1 className="sr-only">{`${menu.restaurant.name} — ${messages.menu}`}</h1>
        <MenuView menu={menu} locale={locale} messages={messages} />
      </main>
      <SiteFooter restaurant={menu.restaurant} messages={messages} />
      <JsonLd data={restaurantJsonLd(menu, locale)} />
    </RestaurantTheme>
  );
}

function restaurantJsonLd(menu: Menu, locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: menu.restaurant.name,
    url: absoluteUrl(`/${locale}/menu`),
    ...(menu.restaurant.address && { address: menu.restaurant.address }),
    ...(menu.restaurant.phone && { telephone: menu.restaurant.phone }),
    hasMenu: {
      "@type": "Menu",
      inLanguage: locale,
      hasMenuSection: menu.categories.map((c) => ({
        "@type": "MenuSection",
        name: c.name,
        hasMenuItem: c.items.map((i) => ({
          "@type": "MenuItem",
          name: i.name,
          ...(i.short_description && { description: i.short_description }),
          url: absoluteUrl(`/${locale}/item/${i.slug}`),
          offers: {
            "@type": "Offer",
            price: (i.price_cents / 100).toFixed(2),
            priceCurrency: i.currency,
            availability:
              i.availability === "unavailable"
                ? "https://schema.org/SoldOut"
                : i.availability === "limited"
                  ? "https://schema.org/LimitedAvailability"
                  : "https://schema.org/InStock",
          },
        })),
      })),
    },
  };
}
