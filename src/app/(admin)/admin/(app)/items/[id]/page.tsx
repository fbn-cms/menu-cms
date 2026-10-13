import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ItemForm, type ItemFormValue } from "./item-form";

export const metadata: Metadata = { title: "Edit dish" };

export default async function ItemEditPage({
  params,
  searchParams,
}: PageProps<"/admin/items/[id]">) {
  const ctx = await requireRole("owner", "admin");
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const [{ data: categories }, { data: tags }, { data: r }] = await Promise.all(
    [
      supabase
        .from("categories")
        .select("id, name")
        .order("sort_order")
        .order("name"),
      supabase
        .from("tags")
        .select("id, label, kind, icon")
        .order("sort_order")
        .order("label"),
      supabase
        .from("restaurants")
        .select("currency")
        .eq("id", ctx.restaurant.id)
        .single(),
    ],
  );
  if (!categories?.length) {
    return (
      <p className="rounded-2xl border p-6 text-sm">
        Create a{" "}
        <Link className="underline" href="/admin/categories/new">
          category
        </Link>{" "}
        first, then add dishes to it.
      </p>
    );
  }
  const currency = r?.currency ?? "CAD";

  if (id === "new") {
    const { category } = await searchParams;
    const blank: ItemFormValue = {
      id: crypto.randomUUID(),
      expectedUpdatedAt: null,
      categoryId:
        typeof category === "string" &&
        categories.some((c) => c.id === category)
          ? category
          : categories[0]!.id,
      name: "",
      slug: "",
      shortDescription: "",
      longDescription: "",
      priceCents: 0,
      prepMinutes: null,
      calories: null,
      spiceLevel: 0,
      isPublished: true,
      iconKey: null,
      iconLqip: null,
      heroKey: null,
      heroLqip: null,
      translations: {
        fa: { name: "", short_description: "", long_description: "" },
        fr: { name: "", short_description: "", long_description: "" },
      },
      tagIds: [],
      variants: [],
    };
    return (
      <ItemForm
        initial={blank}
        isNew
        categories={categories}
        tags={tags ?? []}
        currency={currency}
      />
    );
  }

  const [{ data: item }, { data: tr }, { data: itemTags }, { data: variants }] =
    await Promise.all([
      supabase
        .from("items")
        .select(
          "id, category_id, name, slug, short_description, long_description, price_cents, prep_minutes, calories, spice_level, is_published, icon_key, icon_lqip, hero_key, hero_lqip, updated_at",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("item_translations")
        .select("locale, name, short_description, long_description")
        .eq("item_id", id),
      supabase.from("item_tags").select("tag_id").eq("item_id", id),
      supabase
        .from("item_variants")
        .select("id, name, price_delta_cents, availability, sort_order")
        .eq("item_id", id)
        .order("sort_order"),
    ]);
  if (!item) notFound();
  const t = (l: "fa" | "fr") => {
    const row = tr?.find((x) => x.locale === l);
    return {
      name: row?.name ?? "",
      short_description: row?.short_description ?? "",
      long_description: row?.long_description ?? "",
    };
  };
  const value: ItemFormValue = {
    id: item.id,
    expectedUpdatedAt: item.updated_at,
    categoryId: item.category_id,
    name: item.name,
    slug: item.slug,
    shortDescription: item.short_description ?? "",
    longDescription: item.long_description ?? "",
    priceCents: item.price_cents,
    prepMinutes: item.prep_minutes,
    calories: item.calories,
    spiceLevel: item.spice_level,
    isPublished: item.is_published,
    iconKey: item.icon_key,
    iconLqip: item.icon_lqip,
    heroKey: item.hero_key,
    heroLqip: item.hero_lqip,
    translations: { fa: t("fa"), fr: t("fr") },
    tagIds: (itemTags ?? []).map((x) => x.tag_id),
    variants: (variants ?? []).map((x) => ({
      id: x.id,
      name: x.name,
      priceCents: item.price_cents + x.price_delta_cents,
      availability: x.availability,
    })),
  };
  return (
    <ItemForm
      initial={value}
      isNew={false}
      categories={categories}
      tags={tags ?? []}
      currency={currency}
    />
  );
}
