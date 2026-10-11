// Fails if server-only secrets leak into anything the browser can download. Run after a build.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dirs = [".next/static", ".open-next/assets"].filter(existsSync);
if (!dirs.length) {
  console.error("No build output found — run a build first.");
  process.exit(1);
}
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const needles = ["SERVICE_ROLE", ...(serviceKey ? [serviceKey] : [])];
const hits = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|html|json|txt|map)$/.test(name)) {
      const body = readFileSync(p, "utf8");
      for (const n of needles) if (body.includes(n)) hits.push(p);
    }
  }
};
dirs.forEach(walk);
if (hits.length) {
  console.error(
    "Server secret marker found in client output:\n" +
      [...new Set(hits)].join("\n"),
  );
  process.exit(1);
}
console.log("check:secrets ok");
