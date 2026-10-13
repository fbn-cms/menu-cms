import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { readTheme } from "@/lib/theme";
import { BrandingForm } from "./branding-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireRole("owner");
  const supabase = await createSupabaseServer();
  const { data: r } = await supabase
    .from("restaurants")
    .select("name, logo_key, theme_json, updated_at")
    .eq("id", ctx.restaurant.id)
    .single();
  if (!r) return <p>Restaurant not found.</p>;
  return (
    <div className="space-y-2">
      <h1 className="text-lg font-semibold">Appearance</h1>
      <p className="text-muted-foreground text-sm">
        How the menu looks to your guests. Changes go live as soon as you save.
      </p>
      <BrandingForm
        initial={{
          name: r.name,
          logoKey: r.logo_key,
          theme: readTheme(r.theme_json),
          updatedAt: r.updated_at,
        }}
      />
    </div>
  );
}
