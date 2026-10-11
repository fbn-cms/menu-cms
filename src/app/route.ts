import { negotiateLocale } from "@/i18n/config";

// `/` → best locale from Accept-Language. `?l=auto` lets the page apply a remembered choice
// from localStorage (we deliberately use no cookies).
export function GET(request: Request) {
  const locale = negotiateLocale(request.headers.get("accept-language"));
  return new Response(null, {
    status: 307,
    headers: {
      Location: `/${locale}/menu?l=auto`,
      "Cache-Control": "private, no-store",
      Vary: "Accept-Language",
    },
  });
}
