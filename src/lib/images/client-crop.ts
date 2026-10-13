// Browser-side crop → WebP renditions + LQIP (spec §6). No paid image service, nothing large
// ever uploaded: the phone does the work.
import { MAX_ENCODED_BYTES } from "./client-resize";

export type CropRect = { sx: number; sy: number; sw: number; sh: number };
export type Rendition = { blob: Blob; width: number; height: number };

/** Draw the crop rectangle of `source` into a canvas of out×outH and encode WebP. */
export async function cropToWebp(
  source: ImageBitmap,
  crop: CropRect,
  maxWidth: number,
  aspect: number,
  quality: number,
): Promise<Rendition> {
  const width = Math.max(1, Math.round(Math.min(maxWidth, crop.sw))); // never upscale
  const height = Math.max(1, Math.round(width / aspect));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    source,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    width,
    height,
  );
  const blob = await canvas.convertToBlob({ type: "image/webp", quality });
  if (blob.type !== "image/webp")
    throw new Error(
      "Your browser can't create WebP images. Try Chrome, Edge, Firefox or a recent Safari.",
    );
  if (blob.size > MAX_ENCODED_BYTES)
    throw new Error(
      "That photo is still over 600 KB after compressing. Zoom in a little or try another photo.",
    );
  return { blob, width, height };
}

/** Tiny (24 px wide) blurred placeholder as a data: URL, stored on the row (spec §6). */
export async function makeLqip(
  source: ImageBitmap,
  crop: CropRect,
  aspect: number,
): Promise<string> {
  const width = 24;
  const height = Math.max(1, Math.round(width / aspect));
  const canvas = new OffscreenCanvas(width, height);
  canvas
    .getContext("2d")!
    .drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.5 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return `data:image/webp;base64,${btoa(binary)}`;
}

/** Upload one rendition to R2 through our route handler; returns the content-hashed key. */
export async function uploadImage(
  kind: "icon" | "hero" | "logo",
  blob: Blob,
  itemId?: string,
) {
  const qs = new URLSearchParams({ kind, ...(itemId ? { item: itemId } : {}) });
  const res = await fetch(`/api/admin/images?${qs}`, {
    method: "POST",
    headers: { "Content-Type": "image/webp" },
    body: blob,
  });
  const body = (await res.json().catch(() => ({}))) as {
    key?: string;
    width?: number;
    height?: number;
    error?: string;
  };
  if (!res.ok || !body.key)
    throw new Error(
      body.error ?? "Upload failed. Check your connection and try again.",
    );
  return { key: body.key, width: body.width ?? 0, height: body.height ?? 0 };
}
