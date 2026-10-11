// One-time setup of the first accounts on a hosted environment (gate G6). After this, the
// owner invites everyone else from /admin/team.
//
//   node scripts/bootstrap-team.mjs demo|prod owner:<email> admin:<email> [staff:<email> ...]
//
// - Ensures the restaurant row exists (prod: created UNPUBLISHED — invisible until go-live).
// - Sends each person an invite email (needs SMTP configured first) and creates their profile.
// - Idempotent: existing users/profiles are left as they are.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [envName, ...people] = process.argv.slice(2);
if (!["demo", "prod"].includes(envName) || !people.length) {
  throw new Error(
    "usage: bootstrap-team.mjs demo|prod owner:<email> admin:<email> ...",
  );
}
const env = Object.fromEntries(
  readFileSync(`.env.${envName}`, "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [
      l.slice(0, l.indexOf("=")),
      l.slice(l.indexOf("=") + 1).trim(),
    ]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const slug = env.NEXT_PUBLIC_RESTAURANT_SLUG;

let { data: restaurant } = await db
  .from("restaurants")
  .select("id, name, is_published")
  .eq("slug", slug)
  .maybeSingle();
if (!restaurant) {
  const { data, error } = await db
    .from("restaurants")
    .insert({ name: "Demo Bistro", slug, is_published: false })
    .select("id, name, is_published")
    .single();
  if (error) throw error;
  restaurant = data;
  console.log(`created restaurant "${restaurant.name}" (${slug}), unpublished`);
} else {
  console.log(
    `restaurant "${restaurant.name}" (${slug}) exists, published=${restaurant.is_published}`,
  );
}

const { data: existing } = await db.auth.admin.listUsers({ perPage: 1000 });
for (const entry of people) {
  const [role, email] = entry.split(":");
  if (!["owner", "admin", "staff"].includes(role) || !email?.includes("@"))
    throw new Error(`bad entry ${entry}`);
  let user = existing.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!user) {
    const { data, error } = await db.auth.admin.inviteUserByEmail(email);
    if (error) throw new Error(`${email}: ${error.message}`);
    user = data.user;
    console.log(`invited ${email}`);
  } else {
    console.log(`${email} already has an account`);
  }
  const { error } = await db.from("profiles").upsert(
    {
      id: user.id,
      restaurant_id: restaurant.id,
      email,
      role,
      is_active: true,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`${email} profile: ${error.message}`);
  console.log(`  profile ok (${role})`);
}
