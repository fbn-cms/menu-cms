// What a printed code encodes (spec §11 rule 4): always https://{SITE_URL}/t/{slug}, never a
// deep link, so the destination can be re-pointed in the database without reprinting.
import { absoluteUrl, publicEnv } from "@/lib/env";

export const qrPayloadUrl = (slug: string) => absoluteUrl(`/t/${slug}`);

/** The bare host printed under the code, e.g. "flavoursbynajla.app". */
export const siteHost = () => new URL(publicEnv.NEXT_PUBLIC_SITE_URL).host;

/**
 * Downloads and print sheets only where the site's address is final (production domain).
 * Elsewhere (demo, local) the code is for on-screen testing only (spec §11 rule 3).
 */
export const qrPrintable = () =>
  process.env.NEXT_PUBLIC_QR_PRINTABLE === "true";
