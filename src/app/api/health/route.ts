import { publicEnv } from "@/lib/env";

// Cheap DB round-trip for the keep-alive cron (free Supabase projects pause after 7 idle days).
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    const res = await fetch(
      new URL("/rest/v1/rpc/health", publicEnv.NEXT_PUBLIC_SUPABASE_URL),
      {
        headers: { apikey: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
        cache: "no-store",
      },
    );
    const ok = res.ok && (await res.json()) === true;
    return Response.json(
      { ok, db: ok ? "up" : "down", ms: Date.now() - started },
      { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, db: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
