// Build and deploy one environment, safely.
//   node scripts/deploy.mjs demo|production
// - Builds WITHOUT local files: .env.development.local / .env.local are moved aside during the
//   build (OpenNext would otherwise bake them into the Worker), then restored.
// - Public settings come from .env.demo / .env.prod; secrets stay in `wrangler secret`.
// - Runs the secret/local-setting guard and STOPS if it fails (no pipes hiding exit codes).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync } from "node:fs";

const target = process.argv[2];
const file = { demo: ".env.demo", production: ".env.prod" }[target];
if (!file) throw new Error("usage: node scripts/deploy.mjs demo|production");

const parse = (f) =>
  existsSync(f)
    ? Object.fromEntries(
        readFileSync(f, "utf8")
          .split("\n")
          .filter((l) => /^[A-Z_]+=/.test(l))
          .map((l) => [
            l.slice(0, l.indexOf("=")),
            l.slice(l.indexOf("=") + 1).trim(),
          ]),
      )
    : {};
const publicEnv = Object.fromEntries(
  Object.entries(parse(file)).filter(([k]) => k.startsWith("NEXT_PUBLIC_")),
);
const env = { ...process.env, ...parse(".env.cloudflare"), ...publicEnv };
delete env.AI_FAKE;
delete env.SUPABASE_SECRET_KEY;

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit", env });
const local = [".env.development.local", ".env.local"].filter(existsSync);
for (const f of local) renameSync(f, `${f}.deploy-aside`);
try {
  rmSync(".next", { recursive: true, force: true });
  rmSync(".open-next", { recursive: true, force: true });
  run("npx", ["opennextjs-cloudflare", "build"]);
} finally {
  for (const f of local) renameSync(`${f}.deploy-aside`, f);
}
run("node", ["scripts/check-client-bundle.mjs"]); // throws (non-zero) on any leak → no deploy
run("npx", ["opennextjs-cloudflare", "deploy", "--env", target]);
console.log(`\nDeployed ${target}: ${publicEnv.NEXT_PUBLIC_SITE_URL}`);
