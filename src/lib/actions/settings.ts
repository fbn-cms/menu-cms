"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { IMAGE_KEY_PATTERN } from "@/lib/images/webp";
import { menuTag } from "@/lib/menu/fetch";
import { createSupabaseServer } from "@/lib/supabase/server";
import { checkTheme, isHex } from "@/lib/theme";

export type SettingsResult = { ok: boolean; error?: string };

const hex = z
  .string()
  .refine(isHex, "Use a colour like #1a2b3c")
  .transform((v) => v.toLowerCase());
const input = z.object({
  name: z.string().trim().min(1, "The name can't be empty.").max(120),
  address: z
    .string()
    .trim()
    .max(200, "Address is too long (200 characters max).")
    .transform((v) => v || null),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine(
      (v) => v === "" || /^[+()\d\s.-]{6,40}$/.test(v),
      "Phone can only contain digits, spaces, + ( ) - and .",
    )
    .transform((v) => v || null),
  logoKey: z.string().nullable(),
  theme: z.object({
    preset: z.string().max(20),
    background: hex,
    foreground: hex,
    accent: hex,
    showName: z.boolean(),
    logoWidth: z.number().int().min(1).max(4096).nullable(),
    logoHeight: z.number().int().min(1).max(4096).nullable(),
    copyrightHolder: z.string().trim().max(80),
  }),
  expectedUpdatedAt: z.string(),
});

/** Owner-only: name, logo and colours. RLS ("owner updates settings") enforces the same rule. */
export async function saveBranding(
  raw: z.input<typeof input>,
): Promise<SettingsResult> {
  const ctx = await requireRole("owner");
  const parsed = input.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  const v = parsed.data;

  const problems = checkTheme(v.theme);
  if (problems.length) return { ok: false, error: problems[0]!.message };
  // The logo must be one we stored for THIS restaurant.
  if (
    v.logoKey &&
    (!IMAGE_KEY_PATTERN.test(v.logoKey) ||
      !v.logoKey.startsWith(`${ctx.restaurant.id}/brand/logo-`))
  ) {
    return { ok: false, error: "Invalid logo." };
  }
  if (!v.theme.showName && !v.logoKey) {
    return {
      ok: false,
      error: "Show the name, or upload a logo — the menu needs one of them.",
    };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("restaurants")
    .update({
      name: v.name,
      address: v.address,
      phone: v.phone,
      logo_key: v.logoKey,
      theme_json: v.theme,
    })
    .eq("id", ctx.restaurant.id)
    .eq("updated_at", v.expectedUpdatedAt) // the other owner may have saved meanwhile
    .select("id");
  if (error) return { ok: false, error: "Couldn't save. Try again." };
  if (!data?.length)
    return {
      ok: false,
      error:
        "Someone else changed the settings just now. Reload the page to see their version.",
    };

  revalidateTag(menuTag(ctx.restaurant.slug), { expire: 0 });
  revalidatePath("/admin", "layout"); // admin header shows the name
  return { ok: true };
}
