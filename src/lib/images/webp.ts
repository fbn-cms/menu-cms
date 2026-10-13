// Server-side image checks (spec §6): sniff the bytes, never trust the filename or MIME type.
// We only accept WebP, which the browser produces before upload.

export type WebpInfo = { width: number; height: number };

/** Parse a WebP header (VP8 / VP8L / VP8X). Returns null if the bytes aren't a WebP image. */
export function readWebp(bytes: Uint8Array): WebpInfo | null {
  if (bytes.length < 30) return null;
  const ascii = (o: number, n: number) =>
    String.fromCharCode(...bytes.subarray(o, o + n));
  if (ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WEBP") return null;
  const chunk = ascii(12, 4);
  const u16 = (o: number) => bytes[o]! | (bytes[o + 1]! << 8);
  const u24 = (o: number) =>
    bytes[o]! | (bytes[o + 1]! << 8) | (bytes[o + 2]! << 16);
  if (chunk === "VP8 ") {
    // Lossy: frame tag (3 bytes) + start code 9d 01 2a, then 14-bit width/height.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a)
      return null;
    return { width: u16(26) & 0x3fff, height: u16(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const b = (i: number) => bytes[21 + i]!;
    return {
      width: 1 + (((b(1) & 0x3f) << 8) | b(0)),
      height: 1 + (((b(3) & 0x0f) << 10) | (b(2) << 2) | ((b(1) & 0xc0) >> 6)),
    };
  }
  if (chunk === "VP8X") {
    return { width: 1 + u24(24), height: 1 + u24(27) };
  }
  return null;
}

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // hard cap (spec §6)

export type ImageKind = "logo" | "icon" | "hero";
/** Allowed pixel bounds per kind (sanity check, not the browser's target size). */
export const KIND_BOUNDS: Record<ImageKind, { min: number; max: number }> = {
  logo: { min: 32, max: 1024 },
  icon: { min: 64, max: 800 },
  hero: { min: 320, max: 2400 },
};

/** Content-hashed, immutable R2 key: {restaurant}/{brand|item}/{kind}-{hash}.webp */
export async function imageKey(
  restaurantId: string,
  owner: string,
  kind: ImageKind,
  bytes: Uint8Array,
) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
  );
  const hash = [...digest.subarray(0, 12)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${restaurantId}/${owner}/${kind}-${hash}.webp`;
}

export const IMAGE_KEY_PATTERN =
  /^[0-9a-f-]{36}\/(?:[0-9a-f-]{36}|brand)\/(icon|hero|logo)-[0-9a-f]{16,64}\.webp$/;
