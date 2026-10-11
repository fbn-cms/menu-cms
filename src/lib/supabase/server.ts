import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Supabase client acting AS THE SIGNED-IN USER (publishable key + their session cookie).
 * Every query is subject to RLS — this is the client for all staff/admin data access.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet)
              cookieStore.set(name, value, options);
          } catch {
            // Called from a Server Component: cookies are read-only there. The middleware
            // refreshes the session on every /admin request, so this is safe to ignore.
          }
        },
      },
    },
  );
}
