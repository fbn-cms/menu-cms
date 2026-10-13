import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: vi.fn() }));
const { composeOutput, composeDish } = await import("./menu-ai");

const t = (name: string, options: string[] = []) => ({
  name,
  short_description: "",
  long_description: "",
  options,
});

describe("compose output guard", () => {
  test("accepts clean text", () => {
    expect(
      composeOutput.safeParse({
        en: t("Koobideh Kebab"),
        fa: t("کباب کوبیده"),
        fr: t("Kebab Koobideh"),
      }).success,
    ).toBe(true);
  });
  test("rejects a Cyrillic word inside Persian (seen from a model)", () => {
    expect(
      composeOutput.safeParse({
        en: t("Kebab"),
        fa: t("کوبیده و гриل شده"),
        fr: t("Kebab"),
      }).success,
    ).toBe(false);
  });
  test("rejects Persian script inside French or English", () => {
    expect(
      composeOutput.safeParse({
        en: t("Kebab"),
        fa: t("کباب"),
        fr: t("Kebab کباب"),
      }).success,
    ).toBe(false);
    expect(
      composeOutput.safeParse({
        en: t("Kebab کباب"),
        fa: t("کباب"),
        fr: t("Kebab"),
      }).success,
    ).toBe(false);
  });
});

describe("composeDish post-processing (fake provider)", () => {
  process.env.AI_FAKE = "1";
  const base = {
    notes: "",
    category: "Mains",
    restaurant: "Demo",
    short_description: "",
    long_description: "",
  };

  test("keeps the cook's own source text verbatim and fills the other languages", async () => {
    const out = await composeDish(
      {
        ...base,
        source: "fa",
        name: "ته‌چین",
        short_description: "برنج زعفرانی",
        options: ["بزرگ"],
      },
      { provider: "cloudflare", model: "x" },
    );
    expect(out.fa.name).toBe("ته‌چین");
    expect(out.fa.short_description).toBe("برنج زعفرانی");
    expect(out.fa.options).toEqual(["بزرگ"]);
    expect(out.en.name).toBe("[EN] ته‌چین");
    expect(out.fr.options).toEqual(["[FR] بزرگ"]);
  });
  test("fills a missing source description", async () => {
    const out = await composeDish(
      { ...base, source: "en", name: "Tahchin", options: [] },
      { provider: "anthropic", apiKey: "k", model: "m" },
    );
    expect(out.en.short_description).toBe(
      "[anthropic:EN] Tahchin, from our mains.",
    );
  });
});
