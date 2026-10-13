"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireRole, type StaffContext } from "@/lib/auth";
import { isIconName } from "@/lib/cms/icons";
import { IMAGE_KEY_PATTERN } from "@/lib/images/webp";
import { menuTag } from "@/lib/menu/fetch";
import { createSupabaseServer } from "@/lib/supabase/server";

export type CmsResult =
  | { ok: true; id: string; updatedAt?: string }
  | { ok: false; error: string; conflict?: boolean };

// ---------------------------------------------------------------- shared
const slug = z
  .string()
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Web address: lowercase letters, numbers and dashes only.",
  )
  .max(80);
const optText = (max: number) => z.string().trim().max(max).default("");
const lqip = z
  .string()
  .max(4000)
  .regex(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/)
  .nullable();

function dbError(
  error: { code?: string; message?: string },
  what: string,
): CmsResult {
  switch (error.code) {
    case "40001":
      return {
        ok: false,
        conflict: true,
        error: `Someone else changed this ${what} while you were editing. Reload to see their version, then make your change again.`,
      };
    case "23505":
      return {
        ok: false,
        error: `Another ${what} already uses that web address (slug). Choose a different one.`,
      };
    case "23503":
      return {
        ok: false,
        error: `This ${what} is still in use. Move or delete what uses it first.`,
      };
    case "42501":
      return { ok: false, error: "You don't have permission to do that." };
    default:
      console.error(`[cms] ${what} save failed`, error);
      return {
        ok: false,
        error: "Couldn't save. Check your connection and try again.",
      };
  }
}

function afterWrite(ctx: StaffContext, ...paths: string[]) {
  revalidateTag(menuTag(ctx.restaurant.slug), { expire: 0 }); // diners see it on next load
  for (const p of paths) revalidatePath(p);
}

const editor = () => requireRole("owner", "admin");

// ---------------------------------------------------------------- items
const itemInput = z.object({
  id: z.uuid(),
  expectedUpdatedAt: z.string().nullable(),
  categoryId: z.uuid(),
  name: z.string().trim().min(1, "The English name is required.").max(120),
  slug,
  shortDescription: optText(200),
  longDescription: optText(4000),
  priceCents: z.number().int().min(0).max(10_000_000),
  prepMinutes: z.number().int().min(0).max(600).nullable(),
  calories: z.number().int().min(0).max(10000).nullable(),
  spiceLevel: z.number().int().min(0).max(3),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
  iconKey: z.string().nullable(),
  iconLqip: lqip,
  heroKey: z.string().nullable(),
  heroLqip: lqip,
  translations: z.object({
    fa: z.object({
      name: optText(120),
      short_description: optText(200),
      long_description: optText(4000),
    }),
    fr: z.object({
      name: optText(120),
      short_description: optText(200),
      long_description: optText(4000),
    }),
  }),
  tagIds: z.array(z.uuid()).max(50),
  variants: z
    .array(
      z.object({
        id: z.uuid().nullable(),
        name: z
          .string()
          .trim()
          .min(1, "Each size/option needs a name.")
          .max(80),
        priceCents: z.number().int().min(0).max(10_000_000),
        availability: z.enum(["available", "limited", "unavailable"]),
      }),
    )
    .max(20),
});
export type ItemInput = z.input<typeof itemInput>;

export async function saveItem(raw: ItemInput): Promise<CmsResult> {
  const ctx = await editor();
  const parsed = itemInput.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the form.",
    };
  const v = parsed.data;
  // Image keys must be ones we uploaded for THIS dish of THIS restaurant.
  for (const [key, kind] of [
    [v.iconKey, "icon"],
    [v.heroKey, "hero"],
  ] as const) {
    if (
      key &&
      (!IMAGE_KEY_PATTERN.test(key) ||
        !key.startsWith(`${ctx.restaurant.id}/${v.id}/${kind}-`))
    ) {
      return { ok: false, error: "Invalid photo. Please upload it again." };
    }
  }
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("save_item", {
    p_id: v.id,
    p_restaurant_id: ctx.restaurant.id,
    p_data: {
      category_id: v.categoryId,
      name: v.name,
      slug: v.slug,
      short_description: v.shortDescription,
      long_description: v.longDescription,
      price_cents: v.priceCents,
      prep_minutes: v.prepMinutes,
      calories: v.calories,
      spice_level: v.spiceLevel,
      is_featured: v.isFeatured,
      is_published: v.isPublished,
      icon_key: v.iconKey,
      icon_lqip: v.iconKey ? v.iconLqip : null,
      hero_key: v.heroKey,
      hero_lqip: v.heroKey ? v.heroLqip : null,
    },
    p_translations: v.translations,
    p_tag_ids: v.tagIds,
    // Admin enters each option's full price; the DB stores the difference from the base price.
    p_variants: v.variants.map((x, i) => ({
      id: x.id,
      name: x.name,
      price_delta_cents: x.priceCents - v.priceCents,
      availability: x.availability,
      sort_order: i + 1,
    })),
    p_expected_updated_at: v.expectedUpdatedAt ?? undefined,
  });
  if (error) return dbError(error, "dish");
  const res = data as { id: string; updated_at: string };
  afterWrite(
    ctx,
    "/admin/items",
    `/admin/items/${v.id}`,
    "/admin/availability",
  );
  return { ok: true, id: res.id, updatedAt: res.updated_at };
}

export async function deleteItem(id: string): Promise<CmsResult> {
  const ctx = await editor();
  if (!z.uuid().safeParse(id).success)
    return { ok: false, error: "Invalid input." };
  const supabase = await createSupabaseServer();
  // Photos are queued for nightly cleanup by a DB trigger — never deleted inside the request.
  const { data, error } = await supabase
    .from("items")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return dbError(error, "dish");
  if (!data?.length) return { ok: false, error: "That dish no longer exists." };
  afterWrite(ctx, "/admin/items", "/admin/availability");
  return { ok: true, id };
}

export async function setItemsPublished(
  ids: string[],
  published: boolean,
): Promise<CmsResult> {
  const ctx = await editor();
  if (!z.array(z.uuid()).min(1).max(500).safeParse(ids).success)
    return { ok: false, error: "Select at least one dish." };
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("set_items_published", {
    p_ids: ids,
    p_published: published,
  });
  if (error) return dbError(error, "dish");
  afterWrite(ctx, "/admin/items", "/admin/availability");
  return { ok: true, id: "" };
}

export async function reorderItems(ids: string[]): Promise<CmsResult> {
  const ctx = await editor();
  if (!z.array(z.uuid()).min(1).max(500).safeParse(ids).success)
    return { ok: false, error: "Invalid input." };
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("reorder_items", { p_ids: ids });
  if (error) return dbError(error, "dish");
  afterWrite(ctx, "/admin/items");
  return { ok: true, id: "" };
}

// ---------------------------------------------------------------- categories
const categoryInput = z.object({
  id: z.uuid(),
  expectedUpdatedAt: z.string().nullable(),
  name: z.string().trim().min(1, "The English name is required.").max(80),
  slug,
  description: optText(500),
  isPublished: z.boolean(),
  translations: z.object({
    fa: z.object({ name: optText(80), description: optText(500) }),
    fr: z.object({ name: optText(80), description: optText(500) }),
  }),
});
export type CategoryInput = z.input<typeof categoryInput>;

export async function saveCategory(raw: CategoryInput): Promise<CmsResult> {
  const ctx = await editor();
  const parsed = categoryInput.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the form.",
    };
  const v = parsed.data;
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("save_category", {
    p_id: v.id,
    p_restaurant_id: ctx.restaurant.id,
    p_data: {
      name: v.name,
      slug: v.slug,
      description: v.description,
      is_published: v.isPublished,
    },
    p_translations: v.translations,
    p_expected_updated_at: v.expectedUpdatedAt ?? undefined,
  });
  if (error) return dbError(error, "category");
  const res = data as { id: string; updated_at: string };
  afterWrite(ctx, "/admin/categories", "/admin/items");
  return { ok: true, id: res.id, updatedAt: res.updated_at };
}

export async function deleteCategory(id: string): Promise<CmsResult> {
  const ctx = await editor();
  if (!z.uuid().safeParse(id).success)
    return { ok: false, error: "Invalid input." };
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    if (error.code === "23503")
      return {
        ok: false,
        error: "This category still has dishes. Move or delete them first.",
      };
    return dbError(error, "category");
  }
  if (!data?.length)
    return { ok: false, error: "That category no longer exists." };
  afterWrite(ctx, "/admin/categories", "/admin/items");
  return { ok: true, id };
}

export async function reorderCategories(ids: string[]): Promise<CmsResult> {
  const ctx = await editor();
  if (!z.array(z.uuid()).min(1).max(200).safeParse(ids).success)
    return { ok: false, error: "Invalid input." };
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("reorder_categories", { p_ids: ids });
  if (error) return dbError(error, "category");
  afterWrite(ctx, "/admin/categories");
  return { ok: true, id: "" };
}

// ---------------------------------------------------------------- tags
const tagInput = z.object({
  id: z.uuid(),
  label: z.string().trim().min(1, "The English label is required.").max(40),
  kind: z.enum(["dietary", "feature", "allergen"]),
  icon: z.string().refine(isIconName, "Pick an icon from the list.").nullable(),
  translations: z.object({ fa: optText(40), fr: optText(40) }),
});
export type TagInput = z.input<typeof tagInput>;

export async function saveTag(raw: TagInput): Promise<CmsResult> {
  const ctx = await editor();
  const parsed = tagInput.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the form.",
    };
  const v = parsed.data;
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.rpc("save_tag", {
    p_id: v.id,
    p_restaurant_id: ctx.restaurant.id,
    p_data: { label: v.label, kind: v.kind, icon: v.icon },
    p_translations: v.translations,
  });
  if (error) {
    if (error.code === "23505")
      return {
        ok: false,
        error: "A label with that name already exists in this group.",
      };
    return dbError(error, "label");
  }
  afterWrite(ctx, "/admin/tags", "/admin/items");
  return { ok: true, id: (data as { id: string }).id };
}

export async function deleteTag(id: string): Promise<CmsResult> {
  const ctx = await editor();
  if (!z.uuid().safeParse(id).success)
    return { ok: false, error: "Invalid input." };
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("tags")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return dbError(error, "label");
  if (!data?.length)
    return { ok: false, error: "That label no longer exists." };
  afterWrite(ctx, "/admin/tags", "/admin/items");
  return { ok: true, id };
}
