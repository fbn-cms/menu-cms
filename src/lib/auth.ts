import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServer } from "@/lib/supabase/server";

export type Role = Database["public"]["Enums"]["app_role"];

export type StaffContext = {
  userId: string;
  email: string;
  profile: { full_name: string | null; role: Role; restaurant_id: string };
  restaurant: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    hours_json: unknown;
  };
};

/** The signed-in user's profile + restaurant, or a redirect. Cached per request. */
export const getStaffContext = cache(async (): Promise<StaffContext> => {
  const supabase = await createSupabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, role, restaurant_id, is_active, restaurants(id, name, slug, timezone, hours_json)",
    )
    .eq("id", userId)
    .maybeSingle();
  if (!profile || !profile.is_active || !profile.restaurants)
    redirect("/admin/no-access");

  return {
    userId,
    email: String(claims.claims.email ?? ""),
    profile: {
      full_name: profile.full_name,
      role: profile.role,
      restaurant_id: profile.restaurant_id,
    },
    restaurant: profile.restaurants,
  };
});

/** Where each role lands after sign-in. Staff see only the 86 board. */
export const homeFor = (role: Role) =>
  role === "staff" ? "/admin/availability" : "/admin";

/** Page-level guard: redirect roles that may not see this page to their home. */
export async function requireRole(...roles: Role[]): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!roles.includes(ctx.profile.role)) redirect(homeFor(ctx.profile.role));
  return ctx;
}

/** Only allow redirects back into the admin (no open redirects). */
export function safeNext(
  next: string | null | undefined,
  fallback = "/admin",
): string {
  return next && /^\/admin(\/[\w\-/]*)?$/.test(next) ? next : fallback;
}
