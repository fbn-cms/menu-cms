import type { Metadata } from "next";
import { aiSummary, ANTHROPIC_MODELS, OPENAI_MODELS } from "@/lib/ai/config";
import { requireRole } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { readTheme } from "@/lib/theme";
import { AiSettings } from "./ai-settings";
import { BrandingForm } from "./branding-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireRole("owner");
  const supabase = await createSupabaseServer();
  const { data: r } = await supabase
    .from("restaurants")
    .select("name, address, phone, logo_key, theme_json, updated_at")
    .eq("id", ctx.restaurant.id)
    .single();
  if (!r) return <p>Restaurant not found.</p>;
  const ai = await aiSummary(ctx.restaurant.id); // safe summary: no keys, only last-4 hints
  return (
    <div className="space-y-2">
      <h1 className="text-lg font-semibold">Appearance</h1>
      <p className="text-muted-foreground text-sm">
        How the menu looks to your guests. Changes go live as soon as you save.
      </p>
      <BrandingForm
        initial={{
          name: r.name,
          address: r.address ?? "",
          phone: r.phone ?? "",
          logoKey: r.logo_key,
          theme: readTheme(r.theme_json),
          updatedAt: r.updated_at,
        }}
      />
      <div className="pt-6">
        <AiSettings
          summary={ai}
          anthropicModels={ANTHROPIC_MODELS}
          openaiModels={OPENAI_MODELS}
        />
      </div>
    </div>
  );
}
