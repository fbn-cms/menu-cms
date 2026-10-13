// Fails the deploy if secrets or local-only settings leak into the build. Run after a build.
//  1. Browser output (.next/static, .open-next/assets): the SERVICE_ROLE marker, anything shaped
//     like a Supabase secret key, and the literal secret values from the local env files.
//  2. Server env baked by OpenNext (.open-next/cloudflare/next-env.mjs): it copies .env* values
//     into the Worker. Secrets must come from `wrangler secret`, and test switches (AI_FAKE)
//     must never ship.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dirs = [".next/static", ".open-next/assets"].filter(existsSync);
if (!dirs.length) {
  console.error("No build output found — run a build first.");
  process.exit(1);
}

const secretValues = new Set(
  [process.env.SUPABASE_SECRET_KEY, process.env.CLOUDFLARE_API_TOKEN].filter(
    Boolean,
  ),
);
for (const file of [
  ".env.development.local",
  ".env.local",
  ".env.demo",
  ".env.prod",
  ".env.cloudflare",
]) {
  if (!existsSync(file)) continue;
  for (const m of readFileSync(file, "utf8").matchAll(
    /^(SUPABASE_SECRET_KEY|SUPABASE_DB_PASSWORD|CLOUDFLARE_API_TOKEN|SUPABASE_ACCESS_TOKEN|GMAIL_SMTP_APP_PASSWORD)=(.+)$/gm,
  )) {
    if (m[2].trim()) secretValues.add(m[2].trim());
  }
}
const patterns = [/SERVICE_ROLE/, /sb_secret_[A-Za-z0-9_-]{16,}/];

const hits = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|html|json|txt|map|rsc)$/.test(name)) {
      const body = readFileSync(p, "utf8");
      if (
        patterns.some((re) => re.test(body)) ||
        [...secretValues].some((v) => body.includes(v))
      )
        hits.push(p);
    }
  }
};
dirs.forEach(walk);

const nextEnv = ".open-next/cloudflare/next-env.mjs";
if (existsSync(nextEnv)) {
  const body = readFileSync(nextEnv, "utf8");
  if (/AI_FAKE/.test(body)) {
    hits.push(`${nextEnv}: contains AI_FAKE (local-only test switch)`);
  }
  if (/SUPABASE_SECRET_KEY|sb_secret_/.test(body)) {
    hits.push(
      `${nextEnv}: contains a Supabase secret key (use wrangler secret)`,
    );
  }
  for (const v of secretValues) {
    if (body.includes(v))
      hits.push(`${nextEnv}: contains a known secret value`);
  }
}

if (hits.length) {
  console.error(
    "Secret or local-only setting found in the build:\n" +
      [...new Set(hits)].join("\n"),
  );
  process.exit(1);
}
console.log(
  `check:secrets ok (${secretValues.size} known secret values + key patterns; browser output and server env)`,
);
