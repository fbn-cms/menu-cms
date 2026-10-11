import type { z } from "zod";
import type { Locale } from "@/i18n/config";
import { publicEnv } from "@/lib/env";
import {
  itemDetailSchema,
  menuSchema,
  type ItemDetail,
  type Menu,
} from "./types";

/** Cache tag for everything a restaurant's public pages read. Admin writes revalidate it. */
export const menuTag = (restaurantSlug: string) => `menu:${restaurantSlug}`;

/** Safety-net revalidation; on-demand revalidateTag() is the primary mechanism. */
const REVALIDATE_SECONDS = 600;

async function rpc<S extends z.ZodType>(
  fn: string,
  params: Record<string, string>,
  schema: S,
): Promise<z.infer<S> | null> {
  // GET on a STABLE function → cacheable by Next's data cache.
  const url = new URL(`/rest/v1/rpc/${fn}`, publicEnv.NEXT_PUBLIC_SUPABASE_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { apikey: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    cache: "force-cache",
    next: {
      tags: [menuTag(publicEnv.NEXT_PUBLIC_RESTAURANT_SLUG)],
      revalidate: REVALIDATE_SECONDS,
    },
  });
  if (!res.ok)
    throw new Error(`${fn} failed: ${res.status} ${await res.text()}`);
  const json: unknown = await res.json();
  return json === null ? null : schema.parse(json);
}

export function getMenu(locale: Locale): Promise<Menu | null> {
  return rpc(
    "menu_json",
    {
      p_restaurant_slug: publicEnv.NEXT_PUBLIC_RESTAURANT_SLUG,
      p_locale: locale,
    },
    menuSchema,
  );
}

export function getItem(
  locale: Locale,
  slug: string,
): Promise<ItemDetail | null> {
  return rpc(
    "item_json",
    {
      p_restaurant_slug: publicEnv.NEXT_PUBLIC_RESTAURANT_SLUG,
      p_item_slug: slug,
      p_locale: locale,
    },
    itemDetailSchema,
  );
}

/** Public URL of an R2 image key (served by /img/[...key]). Relative on purpose. */
export const imageUrl = (key: string) => `/img/${key}`;
