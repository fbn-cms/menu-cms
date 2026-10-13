import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { CLOUDFLARE_MODEL, type AiConfig } from "./menu-ai";
import { decryptApiKey } from "./secrets";

export type AiProvider = "cloudflare" | "anthropic" | "openai";

/** Safe-to-show summary (no keys) for Settings and the editor's "Using: …" label. */
export type AiSummary = {
  provider: AiProvider;
  anthropic: { connected: boolean; hint: string | null; model: string };
  openai: { connected: boolean; hint: string | null; model: string };
};

// Rough cost per "Generate" (≈1.4k input + ≈2k output tokens incl. reasoning), at list prices.
export const ANTHROPIC_MODELS = [
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5 — best quality (about 5¢ per dish)",
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5 — very good (about 2¢ per dish)",
  },
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5 — fastest, cheapest (about 0.1¢ per dish)",
  },
] as const;
export const OPENAI_MODELS = [
  {
    id: "gpt-6-astra",
    label: "GPT-6 Astra — best quality (about 9¢ per dish)",
  },
  { id: "gpt-6.1-sol", label: "GPT-6.1 Sol — balanced (about 2¢ per dish)" },
  { id: "gpt-6-luna", label: "GPT-6 Luna — cheapest (about 0.1¢ per dish)" },
] as const;

// Server-only table (no RLS policies): read with the secret key after the caller's role was checked.
async function row(restaurantId: string) {
  const { data } = await createSupabaseAdmin()
    .from("ai_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return data;
}

export async function aiSummary(restaurantId: string): Promise<AiSummary> {
  const r = await row(restaurantId);
  return {
    provider: (r?.provider as AiProvider) ?? "cloudflare",
    anthropic: {
      connected: !!r?.anthropic_key_enc,
      hint: r?.anthropic_key_hint ?? null,
      model: r?.anthropic_model ?? ANTHROPIC_MODELS[0].id,
    },
    openai: {
      connected: !!r?.openai_key_enc,
      hint: r?.openai_key_hint ?? null,
      model: r?.openai_model ?? OPENAI_MODELS[1].id,
    },
  };
}

/** Full config incl. the decrypted key — only ever used server-side to make the AI call. */
export async function loadAiConfig(restaurantId: string): Promise<AiConfig> {
  const r = await row(restaurantId);
  if (r?.provider === "anthropic" && r.anthropic_key_enc) {
    return {
      provider: "anthropic",
      apiKey: await decryptApiKey(
        r.anthropic_key_enc,
        restaurantId,
        "anthropic",
      ),
      model: r.anthropic_model,
    };
  }
  if (r?.provider === "openai" && r.openai_key_enc) {
    return {
      provider: "openai",
      apiKey: await decryptApiKey(r.openai_key_enc, restaurantId, "openai"),
      model: r.openai_model,
    };
  }
  return { provider: "cloudflare", model: CLOUDFLARE_MODEL };
}
