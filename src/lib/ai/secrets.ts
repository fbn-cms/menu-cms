import "server-only";

// AES-256-GCM encryption for stored provider API keys. The 32-byte key comes from the Worker
// secret AI_KEYS_SECRET (base64) and never touches the database. Each ciphertext is bound to its
// restaurant + provider (additional authenticated data), so a value can't be swapped between rows.

export type Provider = "anthropic" | "openai";

const b64 = {
  enc: (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)),
  dec: (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

async function masterKey(): Promise<CryptoKey> {
  const raw = process.env.AI_KEYS_SECRET;
  if (!raw) throw new Error("AI_KEYS_SECRET is not configured on the server.");
  const bytes = b64.dec(raw);
  if (bytes.length !== 32)
    throw new Error("AI_KEYS_SECRET must be 32 bytes (base64).");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

const aad = (restaurantId: string, provider: Provider) =>
  new TextEncoder().encode(`${restaurantId}:${provider}`);

export async function encryptApiKey(
  plain: string,
  restaurantId: string,
  provider: Provider,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: aad(restaurantId, provider) },
      await masterKey(),
      new TextEncoder().encode(plain),
    ),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return `v1:${b64.enc(out)}`;
}

export async function decryptApiKey(
  stored: string,
  restaurantId: string,
  provider: Provider,
): Promise<string> {
  if (!stored.startsWith("v1:")) throw new Error("Unknown key format.");
  const bytes = b64.dec(stored.slice(3));
  const plain = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: bytes.subarray(0, 12),
      additionalData: aad(restaurantId, provider),
    },
    await masterKey(),
    bytes.subarray(12),
  );
  return new TextDecoder().decode(plain);
}

/** Last 4 characters, for display ("••••abcd"). Never return more of a key to the browser. */
export const keyHint = (key: string) => key.slice(-4);
