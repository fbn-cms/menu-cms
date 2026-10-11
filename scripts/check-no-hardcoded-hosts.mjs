// Fails if a deployment hostname is hardcoded in src/. NEXT_PUBLIC_SITE_URL is the only source. (Spec §11)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const banned = [/workers\.dev/i];
const hits = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|mjs|css|json)$/.test(name)) {
      readFileSync(p, "utf8")
        .split("\n")
        .forEach(
          (line, i) =>
            banned.some((re) => re.test(line)) &&
            hits.push(`${p}:${i + 1}: ${line.trim()}`),
        );
    }
  }
};
walk("src");
if (hits.length) {
  console.error(
    "Hardcoded host found (use NEXT_PUBLIC_SITE_URL):\n" + hits.join("\n"),
  );
  process.exit(1);
}
console.log("check:hosts ok");
