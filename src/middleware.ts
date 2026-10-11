import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Guards /admin and keeps the Supabase session cookie fresh. Authorisation (which role may do
// what) is enforced by RLS in Postgres and re-checked in each admin page; this is the first gate.
//
// Uses the deprecated `middleware.ts` (edge) rather than Next 16 `proxy.ts` (Node) because
// OpenNext's Cloudflare support for Node middleware is still experimental. Revisit later.

const PUBLIC_ADMIN_PATHS = ["/admin/login"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet)
            response.cookies.set(name, value, options);
        },
      },
    },
  );

  // getClaims() validates the JWT (and refreshes the session if needed). Do not use getSession().
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  if (!signedIn && !PUBLIC_ADMIN_PATHS.includes(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    login.search =
      pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(login);
  }
  // Admin pages are per-user: never cache them anywhere.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
