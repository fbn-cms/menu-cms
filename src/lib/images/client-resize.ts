// Browser-side resize (spec §6): nothing large ever leaves the phone, and no paid image service.

export const MAX_ENCODED_BYTES = 600 * 1024;

/** Fit the image inside maxSide×maxSide (no crop, keeps transparency) and encode as WebP. */
export async function resizeToWebp(
  file: Blob,
  maxSide: number,
  quality = 0.85,
): Promise<Blob> {
  if (file.type === "image/svg+xml")
    throw new Error("SVG files aren't supported. Use PNG, JPG or WebP.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: "image/webp", quality });
  if (blob.type !== "image/webp")
    throw new Error(
      "Your browser can't create WebP images. Try Chrome, Edge, Firefox or a recent Safari.",
    );
  if (blob.size > MAX_ENCODED_BYTES)
    throw new Error(
      "That image is still too large after resizing. Try a simpler or smaller image.",
    );
  return blob;
}
