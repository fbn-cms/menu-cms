import { getCloudflareContext } from "@opennextjs/cloudflare";
import { IMAGE_KEY_PATTERN as KEY_PATTERN } from "@/lib/images/webp";

// Serves images from the R2 binding. Keys are content-hashed, so responses are immutable and
// cached forever at the edge: {restaurant_id}/{item_id|brand}/{icon|hero|logo}-{hash}.webp

export async function GET(
  _req: Request,
  { params }: RouteContext<"/img/[...key]">,
) {
  const key = (await params).key.join("/");
  if (!KEY_PATTERN.test(key)) return new Response("Not found", { status: 404 });
  const { env } = await getCloudflareContext({ async: true });
  const object = await env.MENU_BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: object.httpEtag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
