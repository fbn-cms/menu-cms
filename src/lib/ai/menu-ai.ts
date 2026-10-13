import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";

// AI help for the dish editor, on Cloudflare Workers AI (free 10,000 neurons/day on the
// restaurant's own Cloudflare account). The output is a SUGGESTION: it lands in the form for a
// person to read and edit; nothing is saved without pressing Save (spec: never translate silently).

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/** The free daily Workers AI allowance is used up (resets 00:00 UTC). */
export class AiQuotaError extends Error {}
const isQuota = (e: unknown) =>
  /4006|neuron|daily (free )?allocation|quota|rate limit|429/i.test(String(e));

export const describeOutput = z.object({
  short_description: z.string().min(1).max(200),
  long_description: z.string().min(1).max(1200),
});
const trText = z.object({
  name: z.string().min(1).max(120),
  short_description: z.string().max(200),
  long_description: z.string().max(4000),
  options: z.array(z.string().max(80)),
});
export const translateOutput = z.object({ fa: trText, fr: trText });

export type DescribeInput = {
  name: string;
  category: string;
  notes: string;
  options: string[];
  restaurant: string;
};
export type TranslateInput = {
  name: string;
  short_description: string;
  long_description: string;
  options: string[];
};

const DESCRIBE_SYSTEM = `You write menu copy for a restaurant.
Rules:
- Plain, appetising English. No hype words ("mouth-watering", "unforgettable"), no emojis, no exclamation marks.
- Use ONLY ingredients and facts implied by the dish name, the category or the cook's notes. Never invent allergens, dietary claims (vegan, halal, gluten-free…), prices or portion sizes.
- short_description: one line for the menu list, at most 120 characters.
- long_description: 2–3 sentences for the dish page, at most 380 characters. Mention how it is served only if the notes say so.`;

const TRANSLATE_SYSTEM = `You translate restaurant menu text from English into Persian (Farsi, as used in Iran) and French (as used in Canada).
Rules:
- Natural menu language, not word-for-word. Keep the meaning exactly; add nothing, remove nothing.
- Dish names: use the dish's real name in that language when one exists (e.g. "Koobideh Kebab" → "کباب کوبیده", "Saffron Ice Cream" → "Glace au safran"); otherwise translate naturally.
- Persian: proper Persian script and punctuation (، ؛), zero-width non-joiner where standard (e.g. "می‌شود"), Western digits.
- French: Canadian French spelling and typography (space before : ; ! ?), "$" after the amount if a price appears.
- options: translate each size/option name in the same order; keep numbers.
- If a field is empty in English, return an empty string for it.`;

function schemaOf(shape: "describe" | "translate") {
  const text = {
    type: "object",
    properties: {
      name: { type: "string" },
      short_description: { type: "string" },
      long_description: { type: "string" },
      options: { type: "array", items: { type: "string" } },
    },
    required: ["name", "short_description", "long_description", "options"],
  };
  return shape === "describe"
    ? {
        type: "object",
        properties: {
          short_description: { type: "string" },
          long_description: { type: "string" },
        },
        required: ["short_description", "long_description"],
      }
    : {
        type: "object",
        properties: { fa: text, fr: text },
        required: ["fa", "fr"],
      };
}

async function runJson<T>(
  schema: z.ZodType<T>,
  shape: "describe" | "translate",
  system: string,
  user: string,
  maxTokens: number,
): Promise<T> {
  const { env } = await getCloudflareContext({ async: true });
  const ai = env.AI;
  if (!ai)
    throw new Error(
      "AI isn't connected in this environment (local runs use AI_FAKE=1).",
    );
  const model = (env.AI_TEXT_MODEL as string | undefined) || DEFAULT_MODEL;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = (await ai.run(
        model as Parameters<typeof ai.run>[0],
        {
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: schemaOf(shape),
          },
          max_tokens: maxTokens,
          temperature: shape === "describe" ? 0.6 : 0.2,
        } as never,
      )) as { response?: unknown };
      const raw =
        typeof res.response === "string"
          ? JSON.parse(res.response)
          : res.response;
      return schema.parse(raw);
    } catch (e) {
      if (isQuota(e)) throw new AiQuotaError("quota");
      lastError = e;
    }
  }
  console.error("[ai] request failed", lastError);
  throw new Error(
    "The AI couldn't produce a usable answer. Try again, or write it yourself.",
  );
}

const clip = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;

export async function describeDish(input: DescribeInput) {
  if (process.env.AI_FAKE === "1") return fakeDescribe(input); // local/e2e only
  const user = JSON.stringify({
    restaurant: input.restaurant,
    category: input.category,
    dish_name: input.name,
    cook_notes: input.notes || "(none)",
    size_or_options: input.options,
  });
  const out = await runJson(
    describeOutput,
    "describe",
    DESCRIBE_SYSTEM,
    user,
    400,
  );
  return {
    short_description: clip(out.short_description.trim(), 200),
    long_description: clip(out.long_description.trim(), 1200),
  };
}

export async function translateDish(input: TranslateInput) {
  if (process.env.AI_FAKE === "1") return fakeTranslate(input); // local/e2e only
  const out = await runJson(
    translateOutput,
    "translate",
    TRANSLATE_SYSTEM,
    JSON.stringify(input),
    1500,
  );
  // Keep option order/length aligned with the English list whatever the model returned.
  for (const l of ["fa", "fr"] as const)
    out[l].options = input.options.map(
      (_, i) => out[l].options[i]?.trim() ?? "",
    );
  return out;
}

// ---------------------------------------------------------------- deterministic fakes (AI_FAKE=1)
function fakeDescribe(i: DescribeInput) {
  return {
    short_description: `[AI] ${i.name}, from our ${i.category.toLowerCase()}.`,
    long_description: `[AI] ${i.name} as described by the kitchen: ${i.notes || "a house favourite"}.`,
  };
}
function fakeTranslate(i: TranslateInput) {
  const t = (prefix: string) => ({
    name: `${prefix} ${i.name}`,
    short_description:
      i.short_description && `${prefix} ${i.short_description}`,
    long_description: i.long_description && `${prefix} ${i.long_description}`,
    options: i.options.map((o) => `${prefix} ${o}`),
  });
  return { fa: t("[FA]"), fr: t("[FR]") };
}
