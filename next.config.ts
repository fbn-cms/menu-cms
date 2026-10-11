import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  experimental: {
    // Diners arrive from a QR scan — almost always first-time visitors on mobile data — so we
    // inline the (small, Tailwind) CSS to remove the render-blocking request. Note for the CSP
    // (Phase 7): requires style-src 'unsafe-inline'; script-src stays strict.
    inlineCss: true,
  },
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
