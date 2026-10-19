"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";

export type QrResult = { ok: true } | { ok: false; error: string };

// Where a code sends diners: the full menu ("/") or one section ("/menu/<category>").
// Changing it never needs a reprint: the printed code only knows /t/<slug>.
const qrInput = z.object({
  id: z.uuid(),
  label: z.string().trim().min(1, "Give the code a name.").max(80),
  targetPath: z
    .string()
    .regex(/^\/(menu\/[a-z0-9]+(-[a-z0-9]+)*)?$/, "Pick where the code opens."),
  isActive: z.boolean(),
});

export async function saveQrCode(
  raw: z.input<typeof qrInput>,
): Promise<QrResult> {
  await requireRole("owner", "admin");
  const parsed = qrInput.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the form.",
    };
  const v = parsed.data;
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("qr_codes")
    .update({
      label: v.label,
      target_path: v.targetPath,
      is_active: v.isActive,
    })
    .eq("id", v.id)
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("[qr] save failed", error);
    return { ok: false, error: "Couldn't save. Try again." };
  }
  revalidatePath("/admin/qr");
  return { ok: true };
}

/** The restaurant-wide code (one per restaurant, decided in Phase 0). */
export async function createQrCode(): Promise<QrResult> {
  const ctx = await requireRole("owner", "admin");
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("qr_codes").insert({
    restaurant_id: ctx.restaurant.id,
    label: "Main menu",
    target_path: "/",
    slug: "main",
  });
  if (error) {
    console.error("[qr] create failed", error);
    return { ok: false, error: "Couldn't create the code. Try again." };
  }
  revalidatePath("/admin/qr");
  return { ok: true };
}
