// Custom Worker entry: the OpenNext app (fetch + its Durable Objects) plus the hourly cron.
// wrangler.jsonc "main" points here. Hourly: expire "sold out until …" flags; 03:00: photo cleanup.
// CANONICAL_HOST (production only): www.<host> gets a permanent redirect to it. The workers.dev
// address is NOT redirected: the owner uses it as a separate test address (2026-10-19).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- absent until `opennextjs-cloudflare build`
// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as app } from "./.open-next/worker.js";
import { expireAvailability } from "./src/lib/cron/expire-availability";
import { deleteUnsavedUploads } from "./src/lib/cron/unsaved-uploads";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- absent until `opennextjs-cloudflare build`
// @ts-ignore `.open-next/worker.js` is generated at build time
export { DOQueueHandler } from "./.open-next/worker.js";

type Env = {
  MENU_BUCKET: R2Bucket;
  CANONICAL_HOST?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
};

/** Hour (0-23) in the restaurant's time zone. */
const localHour = (d: Date) =>
  Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      hour: "numeric",
      hourCycle: "h23",
    }).format(d),
  );

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (env.CANONICAL_HOST && url.hostname === `www.${env.CANONICAL_HOST}`) {
      url.hostname = env.CANONICAL_HOST;
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    return app.fetch(request, env, ctx);
  },

  async scheduled(controller: ScheduledController, env: Env) {
    const now = new Date(controller.scheduledTime);
    if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
      console.warn("cron: skipped (Supabase not configured)");
      return;
    }
    const { SUPABASE_URL: supabaseUrl, SUPABASE_SECRET_KEY: secretKey } = env;
    // Every hour: dishes whose "until" time has passed go back on sale.
    const expired = await expireAvailability(supabaseUrl, secretKey);
    console.log(`cron: availability expired ${expired}`);
    if (localHour(now) !== 3) return; // once a night, 03:00 local
    const result = await deleteUnsavedUploads({
      bucket: env.MENU_BUCKET,
      supabaseUrl,
      secretKey,
      now,
    });
    console.log(
      `cron: unsaved-photo cleanup scanned ${result.scanned}, deleted ${result.deleted.length}`,
      result.deleted,
    );
  },
} satisfies ExportedHandler<Env>;
