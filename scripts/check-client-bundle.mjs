// Fails if server-only secrets leak into anything the browser can download. Run after a build.
// Checks for: the SERVICE_ROLE marker, anything shaped like a Supabase secret key, and the
// literal secret values from the local env files (if present).
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
  ".env.local",
  ".env.demo",
  ".env.prod",
  ".env.cloudflare",
]) {
  if (!existsSync(file)) continue;
  for (const m of readFileSync(file, "utf8").matchAll(
    /^(SUPABASE_SECRET_KEY|SUPABASE_DB_PASSWORD|CLOUDFLARE_API_TOKEN)=(.+)$/gm,
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
if (hits.length) {
  console.error("Server secret found in client output:\n" + hits.join("\n"));
  process.exit(1);
}
console.log(
  `check:secrets ok (${secretValues.size} known secret values + key patterns checked)`,
);
