"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AiError, validateApiKey } from "@/lib/ai/menu-ai";
import { ANTHROPIC_MODELS, OPENAI_MODELS } from "@/lib/ai/config";
import { encryptApiKey, keyHint } from "@/lib/ai/secrets";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

// Owner-only management of external AI keys. The table has no RLS policies, so these actions use
// the secret-key client — ONLY after requireRole("owner"). Keys are tested with the provider, then
// stored encrypted; the browser only ever gets back the last 4 characters.

export type AiSettingsResult = {
  ok: boolean;
  error?: string;
  message?: string;
};

const provider = z.enum(["anthropic", "openai"]);
const label = { anthropic: "Claude", openai: "ChatGPT" } as const;

async function audit(
  restaurantId: string,
  actorId: string,
  action: string,
  after: Record<string, string>,
) {
  await createSupabaseAdmin().from("audit_log").insert({
    restaurant_id: restaurantId,
    actor_id: actorId,
    action,
    entity: "ai_settings",
    entity_id: restaurantId,
    after_json: after, // never contains a key — only provider, model and the last 4 characters
  });
}

export async function saveAiKey(input: {
  provider: "anthropic" | "openai";
  apiKey: string;
  model: string;
}): Promise<AiSettingsResult> {
  const ctx = await requireRole("owner");
  const parsed = z
    .object({
      provider,
      apiKey: z
        .string()
        .trim()
        .min(20, "That doesn't look like a full API key.")
        .max(300),
      model: z.string(),
    })
    .safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  const { apiKey, model } = parsed.data;
  const p = parsed.data.provider;
  const models: readonly { id: string }[] =
    p === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS;
  if (!models.some((m) => m.id === model))
    return { ok: false, error: "Pick a model from the list." };

  try {
    await validateApiKey(p, apiKey); // a cheap authenticated call — catches typos before storing
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof AiError ? e.message : "Couldn't check the key. Try again.",
    };
  }

  const db = createSupabaseAdmin();
  const { data: existing } = await db
    .from("ai_settings")
    .select("provider")
    .eq("restaurant_id", ctx.restaurant.id)
    .maybeSingle();
  const enc = await encryptApiKey(apiKey, ctx.restaurant.id, p);
  const hint = keyHint(apiKey);
  const { error } = await db.from("ai_settings").upsert({
    restaurant_id: ctx.restaurant.id,
    // First external key added → start using it straight away; otherwise keep the owner's choice.
    provider:
      !existing || existing.provider === "cloudflare" ? p : existing.provider,
    ...(p === "anthropic"
      ? {
          anthropic_key_enc: enc,
          anthropic_key_hint: hint,
          anthropic_model: model,
        }
      : { openai_key_enc: enc, openai_key_hint: hint, openai_model: model }),
    updated_by: ctx.userId,
  });
  if (error) {
    console.error("[ai-settings] save failed", error.code);
    return { ok: false, error: "Couldn't save the key. Try again." };
  }
  await audit(ctx.restaurant.id, ctx.userId, "ai_key_added", {
    provider: p,
    model,
    key: `••••${hint}`,
  });
  revalidatePath("/admin/settings");
  return {
    ok: true,
    message: `${label[p]} key checked and saved (••••${hint}).`,
  };
}

export async function removeAiKey(
  p: "anthropic" | "openai",
): Promise<AiSettingsResult> {
  const ctx = await requireRole("owner");
  if (!provider.safeParse(p).success)
    return { ok: false, error: "Invalid input." };
  const db = createSupabaseAdmin();
  const { data: row } = await db
    .from("ai_settings")
    .select("*")
    .eq("restaurant_id", ctx.restaurant.id)
    .maybeSingle();
  if (!row) return { ok: true };
  const other = p === "anthropic" ? "openai" : "anthropic";
  const otherConnected =
    p === "anthropic" ? !!row.openai_key_enc : !!row.anthropic_key_enc;
  // If the removed key was in use, fall back to the other key, or to the free Cloudflare AI.
  const nextProvider =
    row.provider === p ? (otherConnected ? other : "cloudflare") : row.provider;
  const { error } = await db
    .from("ai_settings")
    .update({
      provider: nextProvider,
      ...(p === "anthropic"
        ? { anthropic_key_enc: null, anthropic_key_hint: null }
        : { openai_key_enc: null, openai_key_hint: null }),
      updated_by: ctx.userId,
    })
    .eq("restaurant_id", ctx.restaurant.id);
  if (error) return { ok: false, error: "Couldn't remove the key. Try again." };
  await audit(ctx.restaurant.id, ctx.userId, "ai_key_removed", { provider: p });
  revalidatePath("/admin/settings");
  return {
    ok: true,
    message: `${label[p]} key removed. It's no longer stored anywhere in the app.`,
  };
}

export async function setAiPreferences(input: {
  provider: "cloudflare" | "anthropic" | "openai";
  anthropicModel: string;
  openaiModel: string;
}): Promise<AiSettingsResult> {
  const ctx = await requireRole("owner");
  const parsed = z
    .object({
      provider: z.enum(["cloudflare", "anthropic", "openai"]),
      anthropicModel: z
        .string()
        .refine((m) => ANTHROPIC_MODELS.some((x) => x.id === m)),
      openaiModel: z
        .string()
        .refine((m) => OPENAI_MODELS.some((x) => x.id === m)),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid choice." };
  const v = parsed.data;
  const { error } = await createSupabaseAdmin().from("ai_settings").upsert({
    restaurant_id: ctx.restaurant.id,
    provider: v.provider,
    anthropic_model: v.anthropicModel,
    openai_model: v.openaiModel,
    updated_by: ctx.userId,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23514"
          ? "Add that provider's API key first."
          : "Couldn't save. Try again.",
    };
  }
  await audit(ctx.restaurant.id, ctx.userId, "ai_provider_set", {
    provider: v.provider,
    anthropic_model: v.anthropicModel,
    openai_model: v.openaiModel,
  });
  revalidatePath("/admin/settings");
  return { ok: true, message: "AI settings saved." };
}
