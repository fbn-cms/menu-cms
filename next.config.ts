import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // cacheComponents is off: OpenNext on Cloudflare documents the classic ISR + tag
  // revalidation model, which is what we rely on. Revisit once OpenNext documents support.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

// Exposes Cloudflare bindings (R2, D1, ...) to `next dev`.
initOpenNextCloudflareForDev();
