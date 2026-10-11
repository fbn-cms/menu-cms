import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Supabase client with the SECRET key — bypasses RLS. Use only for operations no user role
 * may perform directly (inviting users, creating profiles, banning a deactivated user, cron).
 * Always verify the caller's permission with the user-scoped client FIRST.
 */
export function createSupabaseAdmin() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
