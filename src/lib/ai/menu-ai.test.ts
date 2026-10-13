import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: vi.fn() }));
const { translateOutput } = await import("./menu-ai");

const tr = (name: string) => ({
  name,
  short_description: "",
  long_description: "",
  options: [],
});

describe("translation output guard", () => {
  test("accepts clean Persian and French", () => {
    expect(
      translateOutput.safeParse({
        fa: tr("کباب کوبیده"),
        fr: tr("Kebab Koobideh"),
      }).success,
    ).toBe(true);
  });
  test("rejects a Cyrillic word inside Persian (seen from the model)", () => {
    expect(
      translateOutput.safeParse({
        fa: tr("کوبیده و гриل شده"),
        fr: tr("Kebab"),
      }).success,
    ).toBe(false);
  });
  test("rejects Persian script inside French", () => {
    expect(
      translateOutput.safeParse({ fa: tr("کباب"), fr: tr("Kebab کباب") })
        .success,
    ).toBe(false);
  });
});
