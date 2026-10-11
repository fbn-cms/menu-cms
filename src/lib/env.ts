// Public, build-time-inlined config. Each variable is referenced literally so Next can inline
// it. No Zod here: this module ships to the browser and must stay tiny.

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}
function url(name: string, value: string | undefined): string {
  const v = required(name, value);
  new URL(v); // throws on a malformed URL
  return v;
}

export const publicEnv = {
  NEXT_PUBLIC_SITE_URL: url(
    "NEXT_PUBLIC_SITE_URL",
    process.env.NEXT_PUBLIC_SITE_URL,
  ),
  NEXT_PUBLIC_RESTAURANT_SLUG: required(
    "NEXT_PUBLIC_RESTAURANT_SLUG",
    process.env.NEXT_PUBLIC_RESTAURANT_SLUG,
  ),
  NEXT_PUBLIC_SUPABASE_URL: url(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
} as const;

/** Absolute URL from a path. The only place a host is composed (spec §11). */
export function absoluteUrl(path: string): string {
  return new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL).toString();
}
