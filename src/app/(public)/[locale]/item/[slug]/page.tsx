import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RestaurantTheme } from "@/components/menu/restaurant-theme";
import { SiteFooter } from "@/components/menu/site-footer";
import { ChevronLeft, Clock, Flame, Utensils, Zap } from "lucide-react";
import { ItemLiveAvailability } from "@/components/menu/item-live-availability";
import { LanguageSwitcher } from "@/components/menu/language-switcher";
import { TagIcon } from "@/components/menu/tag-icon";
import { isLocale } from "@/i18n/config";
import { getMessages, t } from "@/i18n/t";
import { absoluteUrl } from "@/lib/env";
import { formatNumber, formatPrice } from "@/lib/format";
import { getItem, getMenu, imageUrl } from "@/lib/menu/fetch";
import { localeAlternates } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const revalidate = 600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/item/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const [item, menu] = await Promise.all([
    getItem(locale, slug),
    getMenu(locale),
  ]);
  if (!item || !menu) return {};
  const title = `${item.name} — ${menu.restaurant.name}`;
  const description = item.short_description ?? undefined;
  const image = item.hero_key
    ? absoluteUrl(imageUrl(item.hero_key))
    : undefined;
  return {
    title,
    description,
    alternates: localeAlternates(locale, `/item/${slug}`),
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/${locale}/item/${slug}`),
      siteName: menu.restaurant.name,
      locale,
      type: "article",
      ...(image && { images: [image] }),
    },
  };
}

export default async function ItemPage({
  params,
}: PageProps<"/[locale]/item/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const [item, menu] = await Promise.all([
    getItem(locale, slug),
    getMenu(locale),
  ]);
  if (!item || !menu) notFound();
  const messages = getMessages(locale);
  const digits = menu.restaurant.persian_digits;
  const price = (c: number) => formatPrice(c, item.currency, locale, digits);
  const num = (n: number) => formatNumber(n, locale, digits);
  const allergens = item.tags.filter((tag) => tag.kind === "allergen");
  const otherTags = item.tags.filter((tag) => tag.kind !== "allergen");
  const live = {
    restaurantId: menu.restaurant.id,
    item,
    locale,
    digits,
    messages,
  } as const;

  return (
    <RestaurantTheme theme={menu.restaurant.theme}>
      <header className="surface-chrome flex items-center justify-between gap-2 px-2 py-2">
        <Link
          href={`/${locale}/menu/${item.category.slug}`}
          className="hover:bg-muted inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm"
        >
          {/* Directional icon mirrors under RTL; logos and photos never do. */}
          <ChevronLeft aria-hidden="true" className="size-5 rtl:rotate-180" />
          {t(messages.backTo, { category: item.category.name })}
        </Link>
        <LanguageSwitcher current={locale} label={messages.language} />
      </header>

      {/* Availability banner sits at the very top of the content when not available. */}
      <ItemLiveAvailability {...live} variant="banner" />

      <main id="menu">
        {/* Fixed aspect ratio + LQIP background → no layout shift while the hero loads. */}
        <div
          className="bg-muted relative aspect-[4/3] w-full overflow-hidden sm:rounded-b-2xl"
          style={
            item.hero_lqip
              ? {
                  backgroundImage: `url(${item.hero_lqip})`,
                  backgroundSize: "cover",
                }
              : undefined
          }
        >
          {item.hero_key ? (
            // eslint-disable-next-line @next/next/no-img-element -- next/image needs sharp, unavailable on Workers (spec §2)
            <img
              src={imageUrl(item.hero_key)}
              alt={item.name}
              width={1600}
              height={1200}
              fetchPriority="high"
              decoding="async"
              className={cn(
                "size-full object-cover",
                item.availability === "unavailable" && "grayscale",
              )}
            />
          ) : (
            <div className="text-muted-foreground/70 flex size-full flex-col items-center justify-center gap-2">
              <Utensils aria-hidden="true" className="size-12" />
              <span className="text-sm">{messages.noImage}</span>
            </div>
          )}
        </div>

        {/* Ornate: the details sheet lifts over the photo's lower edge. */}
        <article className="surface-card patterned:relative patterned:mx-3 patterned:-mt-8 patterned:rounded-2xl patterned:border patterned:shadow-xl patterned:shadow-black/25 space-y-6 px-4 py-5">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="bidi-text patterned:font-display patterned:text-[1.75rem] text-2xl leading-tight font-semibold">
                {item.name}
              </h1>
              <p className="shrink-0 text-xl font-semibold tabular-nums">
                {price(item.price_cents)}
              </p>
            </div>
            <div className="mt-2">
              <ItemLiveAvailability {...live} variant="badge" />
            </div>
            {/* pre-line keeps the owner's line breaks (e.g. "- Ingredients:" lists). */}
            {item.long_description && (
              <p className="bidi-text mt-4 leading-relaxed whitespace-pre-line">
                {item.long_description}
              </p>
            )}
          </div>

          {item.variants.length > 0 && (
            <section aria-labelledby="options">
              <h2 id="options" className="mb-2 font-semibold">
                {messages.options}
              </h2>
              <ul className="divide-y rounded-xl border">
                {item.variants.map((v) => (
                  <li
                    key={v.id}
                    className={cn(
                      "flex min-h-11 items-center justify-between gap-3 px-4 py-2",
                      v.availability === "unavailable" &&
                        "text-muted-foreground",
                    )}
                  >
                    <span className="bidi-text">
                      {v.name}
                      {v.availability !== "available" && (
                        <span className="ms-2 text-xs">
                          (
                          {v.availability === "limited"
                            ? messages.limited
                            : messages.unavailable}
                          )
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums">{price(v.price_cents)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {item.prep_minutes != null && (
              <Fact
                icon={<Clock aria-hidden="true" className="size-4" />}
                label={messages.prepTime}
                value={t(messages.minutes, { count: num(item.prep_minutes) })}
              />
            )}
            {item.calories != null && (
              <Fact
                icon={<Zap aria-hidden="true" className="size-4" />}
                label={messages.calories}
                value={t(messages.kcal, { count: num(item.calories) })}
              />
            )}
            <Fact
              icon={<Flame aria-hidden="true" className="size-4" />}
              label={messages.spiceLevel}
              value={
                messages[
                  `spice${Math.min(3, Math.max(0, item.spice_level))}` as "spice0"
                ]
              }
            />
          </dl>

          {otherTags.length > 0 && (
            <section aria-labelledby="dietary">
              <h2 id="dietary" className="mb-2 font-semibold">
                {messages.dietary}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {otherTags.map((tag) => (
                  <li
                    key={tag.id}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm"
                  >
                    <TagIcon name={tag.icon} className="size-4" />
                    {tag.label}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {allergens.length > 0 && (
            <section aria-labelledby="allergens">
              <h2 id="allergens" className="mb-2 font-semibold">
                {messages.allergens}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {allergens.map((tag) => (
                  <li
                    key={tag.id}
                    className="bg-muted inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm"
                  >
                    <TagIcon name={tag.icon} className="size-4" />
                    {tag.label}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </main>
      <SiteFooter restaurant={menu.restaurant} messages={messages} />
    </RestaurantTheme>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-muted/60 rounded-xl px-3 py-2">
      <dt className="text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
