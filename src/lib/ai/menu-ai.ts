import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { glossaryText } from "./glossary";

// AI help for the dish editor. One task — "compose": the cook types a dish in ANY of the three
// languages; the AI writes missing descriptions in that language and fills the other two.
// Providers (chosen by the owner in Settings → AI): Claude (Anthropic SDK), ChatGPT (OpenAI
// Responses API), or the free Cloudflare Workers AI fallback.
// The output is a SUGGESTION: it lands in the form for a person to review; nothing is saved until
// Save (spec: never machine-translate silently). Text the cook typed is kept verbatim.

export type Lang = "en" | "fa" | "fr";
export const LANGS: Lang[] = ["en", "fa", "fr"];
export type AiConfig =
  | { provider: "cloudflare"; model: string }
  | { provider: "anthropic"; apiKey: string; model: string }
  | { provider: "openai"; apiKey: string; model: string };

export const CLOUDFLARE_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// ---------------------------------------------------------------- errors shown to the editor
export class AiError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}
const providerName = {
  cloudflare: "the free Cloudflare AI",
  anthropic: "Claude",
  openai: "ChatGPT",
} as const;

// ---------------------------------------------------------------- output schema
const langText = z.object({
  name: z.string().max(120),
  short_description: z.string().max(400),
  long_description: z.string().max(4000),
  options: z.array(z.string().max(80)),
});
/** Shape sent to the providers (no refinements: must convert cleanly to JSON Schema). */
export const composeShape = z.object({
  en: langText,
  fa: langText,
  fr: langText,
});
export type Composed = z.infer<typeof composeShape>;

// Models occasionally slip words from another alphabet into a translation (seen in testing:
// a Cyrillic word inside Persian). Such output is rejected and retried.
const FOREIGN_IN_FA = /[Ѐ-ӿ぀-ヿ一-鿿가-힯]/;
const FOREIGN_IN_LATIN = /[؀-ۿЀ-ӿ぀-ヿ一-鿿가-힯]/;
const allText = (t: z.infer<typeof langText>) =>
  [t.name, t.short_description, t.long_description, ...t.options].join(" ");
export const composeOutput = composeShape
  .refine(
    (o) => !FOREIGN_IN_FA.test(allText(o.fa)),
    "Persian contains another alphabet",
  )
  .refine(
    (o) => !FOREIGN_IN_LATIN.test(allText(o.fr)),
    "French contains another alphabet",
  )
  .refine(
    (o) => !FOREIGN_IN_LATIN.test(allText(o.en)),
    "English contains another alphabet",
  );

// Strict JSON Schema for OpenAI structured outputs / Workers AI JSON mode.
const langJson = {
  type: "object",
  properties: {
    name: { type: "string" },
    short_description: { type: "string" },
    long_description: { type: "string" },
    options: { type: "array", items: { type: "string" } },
  },
  required: ["name", "short_description", "long_description", "options"],
  additionalProperties: false,
};
const composeJsonSchema = {
  type: "object",
  properties: { en: langJson, fa: langJson, fr: langJson },
  required: ["en", "fa", "fr"],
  additionalProperties: false,
};

// ---------------------------------------------------------------- prompt
const SYSTEM = `You write and translate menu text for a restaurant, in English, Persian (Farsi, as used in Iran) and French (as used in Canada).

You receive one dish in a SOURCE language: its name, maybe a short and/or full description, optional cook's notes, and its size/option names. Return the dish in all three languages.

Writing (only when the source short or full description is empty):
- Write it in the source language from the name, category and cook's notes.
- Plain, appetising language. No hype words, no emojis, no exclamation marks.
- Use ONLY facts implied by the name, category or notes. Never invent ingredients, allergens, dietary claims (vegan, halal, gluten-free…), prices or portion sizes.
- short_description: one line for the menu list, at most 120 characters. long_description: 2–3 sentences, at most 380 characters.

Translating:
- Natural menu language, not word-for-word. Keep the meaning exactly; add nothing, remove nothing.
- Dish names: use the dish's real name in each language when one exists (e.g. "Koobideh Kebab" ↔ "کباب کوبیده" ↔ "Kebab Koobideh"); otherwise translate naturally.
- Persian: proper Persian script and punctuation (، ؛), zero-width non-joiner where standard (e.g. "می‌شود"), Western digits 0–9 only.
- French: Canadian French spelling and typography (space before : ; ! ?).
- options: the size/option names in each language, same order and count as given.
- ALWAYS use these fixed terms when the text contains them:
${glossaryText()}

The source language's text that was provided must be returned exactly as given.`;

export type ComposeInput = {
  source: Lang;
  name: string;
  short_description: string;
  long_description: string;
  notes: string;
  options: string[];
  category: string;
  restaurant: string;
};

const userMessage = (i: ComposeInput) =>
  JSON.stringify({
    restaurant: i.restaurant,
    category: i.category,
    source_language: { en: "English", fa: "Persian", fr: "French" }[i.source],
    name: i.name,
    short_description: i.short_description || "(empty — write it)",
    long_description: i.long_description || "(empty — write it)",
    cook_notes: i.notes || "(none)",
    options: i.options,
  });

// ---------------------------------------------------------------- providers
async function runCloudflare(input: ComposeInput): Promise<unknown> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.AI)
    throw new AiError(
      "The free Cloudflare AI isn't connected in this environment.",
      503,
    );
  try {
    const res = (await env.AI.run(
      (env.AI_TEXT_MODEL as string | undefined) || CLOUDFLARE_MODEL,
      {
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMessage(input) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: composeJsonSchema,
        },
        max_tokens: 2500,
        temperature: 0.3,
      } as never,
    )) as { response?: unknown };
    return typeof res.response === "string"
      ? JSON.parse(res.response)
      : res.response;
  } catch (e) {
    if (/4006|neuron|daily (free )?allocation|quota/i.test(String(e))) {
      throw new AiError(
        "Today's free AI allowance is used up. It resets daily at midnight UTC — or add your own Claude/ChatGPT key in Settings → AI.",
        429,
      );
    }
    throw e;
  }
}

/** Models that accept the server-side refusal fallback ("fallbacks: default"). */
const supportsFallback = (model: string) =>
  /^claude-(opus-5|opus-5-5|sonnet-5-5|fable-5)/.test(model);

async function runAnthropic(
  cfg: { apiKey: string; model: string },
  input: ComposeInput,
): Promise<unknown> {
  const client = new Anthropic({
    apiKey: cfg.apiKey,
    maxRetries: 1,
    timeout: 90_000,
  });
  try {
    const res = await client.beta.messages.parse({
      model: cfg.model,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: "user", content: userMessage(input) }],
      output_config: {
        effort: "medium",
        format: betaZodOutputFormat(composeShape),
      },
      ...(supportsFallback(cfg.model)
        ? {
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default" as const,
          }
        : {}),
    });
    if (res.stop_reason === "refusal")
      throw new AiError(
        "Claude declined this request. Try rewording the name or notes.",
        422,
      );
    if (res.stop_reason === "max_tokens")
      throw new AiError("Claude's answer was cut short. Try again.", 502);
    return res.parsed_output;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (
      e instanceof Anthropic.AuthenticationError ||
      e instanceof Anthropic.PermissionDeniedError
    ) {
      throw new AiError(
        "Your Claude API key was rejected. Check or replace it in Settings → AI.",
        401,
      );
    }
    if (e instanceof Anthropic.RateLimitError)
      throw new AiError(
        "Claude is busy (rate limit). Wait a minute and try again.",
        429,
      );
    if (
      e instanceof Anthropic.APIError &&
      (e.status === 402 ||
        e.type === "billing_error" ||
        /credit balance/i.test(e.message))
    ) {
      throw new AiError(
        "Your Anthropic account is out of credit. Add credit at console.anthropic.com, or switch provider in Settings → AI.",
        402,
      );
    }
    if (e instanceof Anthropic.NotFoundError)
      throw new AiError(
        `Claude doesn't recognise the model "${cfg.model}". Pick another in Settings → AI.`,
        400,
      );
    if (e instanceof Anthropic.APIConnectionError)
      throw new AiError(
        "Couldn't reach Claude. Check the connection and try again.",
        503,
      );
    throw e;
  }
}

async function runOpenAI(
  cfg: { apiKey: string; model: string },
  input: ComposeInput,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        input: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMessage(input) },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "dish_text",
            schema: composeJsonSchema,
            strict: true,
          },
        },
        max_output_tokens: 16000,
      }),
    });
  } catch {
    throw new AiError(
      "Couldn't reach ChatGPT. Check the connection and try again.",
      503,
    );
  }
  const body = (await res.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
    output?: {
      type: string;
      content?: { type: string; text?: string; refusal?: string }[];
    }[];
  };
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new AiError(
        "Your ChatGPT (OpenAI) API key was rejected. Check or replace it in Settings → AI.",
        401,
      );
    if (body.error?.code === "insufficient_quota") {
      throw new AiError(
        "Your OpenAI account is out of credit. Add credit at platform.openai.com, or switch provider in Settings → AI.",
        402,
      );
    }
    if (res.status === 429)
      throw new AiError(
        "ChatGPT is busy (rate limit). Wait a minute and try again.",
        429,
      );
    if (res.status === 404 || body.error?.code === "model_not_found") {
      throw new AiError(
        `ChatGPT doesn't recognise the model "${cfg.model}". Pick another in Settings → AI.`,
        400,
      );
    }
    throw new AiError(
      `ChatGPT returned an error (${res.status}). Try again.`,
      502,
    );
  }
  const parts = body.output?.find((o) => o.type === "message")?.content ?? [];
  const refusal = parts.find((p) => p.type === "refusal");
  if (refusal)
    throw new AiError(
      "ChatGPT declined this request. Try rewording the name or notes.",
      422,
    );
  const text = parts.find((p) => p.type === "output_text")?.text;
  if (!text)
    throw new AiError("ChatGPT returned an empty answer. Try again.", 502);
  return JSON.parse(text);
}

// ---------------------------------------------------------------- compose
const westernDigits = (t: string) =>
  t.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
const clip = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;

/** Post-process: keep the cook's own text verbatim, align options, normalise digits and lengths. */
function finish(raw: Composed, input: ComposeInput): Composed {
  const out = structuredClone(raw);
  for (const l of LANGS) {
    out[l] = {
      name: clip(out[l].name.trim(), 120),
      short_description: clip(out[l].short_description.trim(), 200),
      long_description: clip(out[l].long_description.trim(), 4000),
      options: input.options.map((_, i) =>
        clip((out[l].options[i] ?? "").trim(), 80),
      ),
    };
  }
  const src = out[input.source];
  src.name = input.name;
  if (input.short_description) src.short_description = input.short_description;
  if (input.long_description) src.long_description = input.long_description;
  src.options = [...input.options];
  out.fa = {
    name: westernDigits(out.fa.name),
    short_description: westernDigits(out.fa.short_description),
    long_description: westernDigits(out.fa.long_description),
    options: out.fa.options.map(westernDigits),
  };
  return out;
}

export async function composeDish(
  input: ComposeInput,
  cfg: AiConfig,
): Promise<Composed> {
  if (process.env.AI_FAKE === "1")
    return finish(fakeCompose(input, cfg), input); // local/e2e only
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw =
        cfg.provider === "anthropic"
          ? await runAnthropic(cfg, input)
          : cfg.provider === "openai"
            ? await runOpenAI(cfg, input)
            : await runCloudflare(input);
      const out = finish(composeOutput.parse(raw), input);
      // Weaker models sometimes skip the writing part (empty, or just the dish name again).
      // Treat that as a failed answer and retry once.
      const written = (s: string, name: string) =>
        s.trim().length > name.trim().length + 10;
      for (const l of LANGS) {
        if (
          !input.short_description &&
          !written(out[l].short_description, out[l].name)
        ) {
          throw new Error(`short description missing in ${l}`);
        }
      }
      return out;
    } catch (e) {
      if (e instanceof AiError) throw e; // clear, non-retryable outcome
      lastError = e; // invalid/foreign-alphabet output, transient failure → retry once
    }
  }
  console.error("[ai] compose failed", cfg.provider, lastError);
  throw new AiError(
    `${providerName[cfg.provider]} couldn't produce a usable answer. Try again, or write it yourself.`,
  );
}

// ---------------------------------------------------------------- key validation
/** Cheap authenticated call (lists models) to check a key before storing it. */
export async function validateApiKey(
  provider: "anthropic" | "openai",
  apiKey: string,
): Promise<void> {
  if (process.env.AI_FAKE === "1") {
    if (!apiKey.startsWith("test-valid-"))
      throw new AiError("The key was rejected by the provider.", 401);
    return;
  }
  if (provider === "anthropic") {
    try {
      await new Anthropic({
        apiKey,
        maxRetries: 0,
        timeout: 15_000,
      }).models.list({ limit: 1 });
    } catch (e) {
      if (
        e instanceof Anthropic.AuthenticationError ||
        e instanceof Anthropic.PermissionDeniedError
      ) {
        throw new AiError(
          "Anthropic rejected this key. Copy it again from console.anthropic.com → API keys.",
          401,
        );
      }
      throw new AiError(
        "Couldn't reach Anthropic to check the key. Try again.",
        503,
      );
    }
    return;
  }
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  }).catch(() => null);
  if (!res)
    throw new AiError(
      "Couldn't reach OpenAI to check the key. Try again.",
      503,
    );
  if (res.status === 401 || res.status === 403) {
    throw new AiError(
      "OpenAI rejected this key. Copy it again from platform.openai.com → API keys.",
      401,
    );
  }
  if (!res.ok)
    throw new AiError(
      `OpenAI returned an error (${res.status}) while checking the key.`,
      502,
    );
}

// ---------------------------------------------------------------- deterministic fake (AI_FAKE=1)
function fakeCompose(i: ComposeInput, cfg: AiConfig): Composed {
  const tag = cfg.provider === "cloudflare" ? "" : `${cfg.provider}:`;
  const t = (l: Lang) => ({
    name: `[${tag}${l.toUpperCase()}] ${i.name}`,
    short_description: `[${tag}${l.toUpperCase()}] ${i.short_description || `${i.name}, from our ${i.category.toLowerCase()}.`}`,
    long_description: `[${tag}${l.toUpperCase()}] ${i.long_description || `${i.name}: ${i.notes || "a house favourite"}.`}`,
    options: i.options.map((o) => `[${tag}${l.toUpperCase()}] ${o}`),
  });
  return { en: t("en"), fa: t("fa"), fr: t("fr") };
}
