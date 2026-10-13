import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { getStaffContext } from "@/lib/auth";
import {
  imageKey,
  KIND_BOUNDS,
  MAX_UPLOAD_BYTES,
  readWebp,
  type ImageKind,
} from "@/lib/images/webp";

// Upload one WebP image straight to the R2 binding (spec §6: no S3 SDK, no presigned URLs).
// Returns the content-hashed key; the caller saves it on the row in a separate action.
//   POST /api/admin/images?kind=logo|icon|hero[&item=<uuid>]   body: raw image/webp bytes
const query = z.object({
  kind: z.enum(["logo", "icon", "hero"]),
  item: z.uuid().optional(),
});

export async function POST(request: Request) {
  const ctx = await getStaffContext().catch(() => null);
  if (!ctx) return Response.json({ error: "Sign in again." }, { status: 401 });

  const parsed = query.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return Response.json({ error: "Bad request." }, { status: 400 });
  const { kind, item } = parsed.data;
  // Logo/branding: owner only. Dish photos: owner or admin. (RLS re-checks when the key is saved.)
  const allowed =
    kind === "logo"
      ? ctx.profile.role === "owner"
      : ctx.profile.role !== "staff";
  if (!allowed)
    return Response.json({ error: "Not allowed." }, { status: 403 });
  if (kind !== "logo" && !item)
    return Response.json({ error: "Missing item." }, { status: 400 });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES)
    return Response.json(
      { error: "File too large (2 MB max)." },
      { status: 413 },
    );
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > MAX_UPLOAD_BYTES)
    return Response.json(
      { error: "File too large (2 MB max)." },
      { status: 413 },
    );

  const info = readWebp(bytes); // content sniffing, not the filename
  if (!info)
    return Response.json(
      { error: "Only WebP images are accepted." },
      { status: 415 },
    );
  const { min, max } = KIND_BOUNDS[kind as ImageKind];
  if (
    info.width < min ||
    info.height < min ||
    info.width > max ||
    info.height > max
  ) {
    return Response.json(
      { error: `Image must be between ${min} and ${max} pixels.` },
      { status: 422 },
    );
  }

  const key = await imageKey(
    ctx.restaurant.id,
    kind === "logo" ? "brand" : item!,
    kind,
    bytes,
  );
  const { env } = await getCloudflareContext({ async: true });
  await env.MENU_BUCKET.put(key, bytes, {
    httpMetadata: {
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return Response.json({ key, width: info.width, height: info.height });
}
