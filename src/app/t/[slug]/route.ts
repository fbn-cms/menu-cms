import { negotiateLocale } from "@/i18n/config";
import { publicEnv } from "@/lib/env";
import { isBot, uaFamily } from "@/lib/qr/scan";

// QR landing (spec §4): records an anonymous scan, then sends the diner to the code's target.
// A printed code must never dead-end: unknown or deactivated slugs still land on the menu.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(
  request: Request,
  { params }: RouteContext<"/t/[slug]">,
) {
  const { slug } = await params;
  const ua = request.headers.get("user-agent");
  let target: string | null = null;
  if (SLUG.test(slug)) {
    try {
      const res = await fetch(
        new URL("/rest/v1/rpc/record_scan", publicEnv.NEXT_PUBLIC_SUPABASE_URL),
        {
          method: "POST",
          headers: {
            apikey: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_slug: slug,
            p_ua_family: uaFamily(ua),
            p_is_bot: isBot(ua),
          }),
          cache: "no-store",
        },
      );
      if (res.ok) target = (await res.json()) as string | null;
    } catch {
      // Logging is best effort; the diner still gets the menu.
    }
  }
  // target_path is relative ("/" or "/menu/breakfast"); the DB constraint forbids "//host".
  const path =
    !target || target === "/"
      ? "/"
      : `/${negotiateLocale(request.headers.get("accept-language"))}${target}?l=auto`;
  return new Response(null, {
    status: 302,
    headers: { Location: path, "Cache-Control": "private, no-store" },
  });
}
