import { beforeAll, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { decryptApiKey, encryptApiKey, keyHint } = await import("./secrets");
const R = "00000000-0000-4000-8000-000000000001";

beforeAll(() => {
  process.env.AI_KEYS_SECRET = Buffer.alloc(32, 7).toString("base64");
});

test("round-trips and never stores the key in clear", async () => {
  const stored = await encryptApiKey("sk-ant-test-1234567890", R, "anthropic");
  expect(stored).toMatch(/^v1:/);
  expect(stored).not.toContain("sk-ant");
  expect(await decryptApiKey(stored, R, "anthropic")).toBe(
    "sk-ant-test-1234567890",
  );
});

test("same key encrypts differently each time (random IV)", async () => {
  expect(await encryptApiKey("k", R, "openai")).not.toBe(
    await encryptApiKey("k", R, "openai"),
  );
});

test("ciphertext is bound to restaurant and provider", async () => {
  const stored = await encryptApiKey("sk-xyz", R, "openai");
  await expect(decryptApiKey(stored, R, "anthropic")).rejects.toThrow();
  await expect(
    decryptApiKey(stored, "00000000-0000-4000-8000-000000000002", "openai"),
  ).rejects.toThrow();
});

test("a wrong master secret can't decrypt", async () => {
  const stored = await encryptApiKey("sk-xyz", R, "openai");
  process.env.AI_KEYS_SECRET = Buffer.alloc(32, 9).toString("base64");
  await expect(decryptApiKey(stored, R, "openai")).rejects.toThrow();
  process.env.AI_KEYS_SECRET = Buffer.alloc(32, 7).toString("base64");
});

test("hint shows only the last 4 characters", () => {
  expect(keyHint("sk-ant-api03-abcdefWXYZ")).toBe("WXYZ");
});
