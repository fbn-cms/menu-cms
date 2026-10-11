import { z } from "zod";

// Shapes returned by public.menu_json / public.item_json. Validated at the server boundary.
export const availabilitySchema = z.enum([
  "available",
  "limited",
  "unavailable",
]);

export const tagSchema = z.object({
  id: z.string(),
  kind: z.enum(["dietary", "feature", "allergen"]),
  icon: z.string().nullable(),
  label: z.string(),
});

export const menuItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  category_id: z.string(),
  name: z.string(),
  short_description: z.string().nullable(),
  price_cents: z.number().int(),
  currency: z.string(),
  icon_key: z.string().nullable(),
  icon_lqip: z.string().nullable(),
  availability: availabilitySchema,
  availability_note: z.string().nullable(),
  remaining_qty: z.number().int().nullable(),
  spice_level: z.number().int(),
  is_featured: z.boolean(),
  sort_order: z.number().int(),
  tag_ids: z.array(z.string()),
});

export const categorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  icon_key: z.string().nullable(),
  items: z.array(menuItemSchema),
});

export const restaurantSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo_key: z.string().nullable(),
  currency: z.string(),
  timezone: z.string(),
  persian_digits: z.enum(["latn", "arabext"]),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  hours: z.record(z.string(), z.array(z.tuple([z.string(), z.string()]))),
  banner_message: z.string().nullable(),
  theme: z.record(z.string(), z.unknown()),
});

export const menuSchema = z.object({
  restaurant: restaurantSchema,
  locale: z.string(),
  tags: z.array(tagSchema),
  categories: z.array(categorySchema),
});

export const itemDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  short_description: z.string().nullable(),
  long_description: z.string().nullable(),
  price_cents: z.number().int(),
  currency: z.string(),
  icon_key: z.string().nullable(),
  hero_key: z.string().nullable(),
  hero_lqip: z.string().nullable(),
  availability: availabilitySchema,
  availability_note: z.string().nullable(),
  remaining_qty: z.number().int().nullable(),
  prep_minutes: z.number().int().nullable(),
  calories: z.number().int().nullable(),
  spice_level: z.number().int(),
  is_featured: z.boolean(),
  updated_at: z.string(),
  category: z.object({ id: z.string(), slug: z.string(), name: z.string() }),
  variants: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      price_cents: z.number().int(),
      availability: availabilitySchema,
    }),
  ),
  tags: z.array(tagSchema),
});

/** Payload of the `availability` broadcast on channel `menu:<restaurant_id>`. */
export const availabilityPatchSchema = z.object({
  id: z.string(),
  category_id: z.string(),
  availability: availabilitySchema,
  availability_note: z.string().nullable(),
  remaining_qty: z.number().int().nullable(),
  availability_until: z.string().nullable(),
});

export type Menu = z.infer<typeof menuSchema>;
export type MenuCategory = z.infer<typeof categorySchema>;
export type MenuItem = z.infer<typeof menuItemSchema>;
export type MenuTag = z.infer<typeof tagSchema>;
export type ItemDetail = z.infer<typeof itemDetailSchema>;
export type AvailabilityPatch = z.infer<typeof availabilityPatchSchema>;
