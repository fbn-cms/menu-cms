import { describe, expect, test } from "vitest";
import { IMAGE_KEY_PATTERN, imageKey, readWebp } from "./webp";

// Real files produced by Chromium's encoder (canvas.convertToBlob "image/webp"), as uploads are.
const LOSSY_64x48 = Uint8Array.from(
  Buffer.from(
    "UklGRjACAABXRUJQVlA4WAoAAAAgAAAAPwAALwAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZWUDggQgAAAJADAJ0BKkAAMAA+bTaYSSQjIqEiqACADYlnAHYAACqzOhNpigAA/vA4Q//i1rcLSw//+0s/+pZ/9Sz/GJUUqxwAAA==",
    "base64",
  ),
);

describe("readWebp", () => {
  test("reads the dimensions of a real browser-encoded WebP", () => {
    expect(readWebp(LOSSY_64x48)).toEqual({ width: 64, height: 48 });
  });
  test.each([
    [
      "PNG",
      Buffer.from(
        "89504e470d0a1a0a0000000d4948445200000001000000010806000000",
        "hex",
      ),
    ],
    [
      "SVG",
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
      ),
    ],
    ["empty", Buffer.alloc(0)],
  ])("rejects %s", (_, bytes) => {
    expect(readWebp(Uint8Array.from(bytes))).toBeNull();
  });
});

test("keys are content-hashed and match the serving pattern", async () => {
  const rid = "00000000-0000-4000-8000-000000000001";
  const a = await imageKey(rid, "brand", "logo", LOSSY_64x48);
  const b = await imageKey(rid, "brand", "logo", LOSSY_64x48);
  expect(a).toBe(b);
  expect(a).toMatch(IMAGE_KEY_PATTERN);
  expect(IMAGE_KEY_PATTERN.test(`${rid}/brand/logo-../../x.webp`)).toBe(false);
});
