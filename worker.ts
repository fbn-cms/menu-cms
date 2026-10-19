// Custom Worker entry: the OpenNext app (fetch + its Durable Objects) plus the hourly cron.
// wrangler.jsonc "main" points here. Only the photo cleanup is scheduled for now.
// CANONICAL_HOST (production only): every other host (www., the workers.dev address) gets a
// permanent redirect, so links and any code printed before the move keep working (spec §11).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- absent until `opennextjs-cloudflare build`
// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as app } from "./.open-next/worker.js";
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
    if (env.CANONICAL_HOST && url.hostname !== env.CANONICAL_HOST) {
      url.hostname = env.CANONICAL_HOST;
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    return app.fetch(request, env, ctx);
  },

  async scheduled(controller: ScheduledController, env: Env) {
    const now = new Date(controller.scheduledTime);
    if (localHour(now) !== 3) return; // once a night, 03:00 local
    if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
      console.warn(
        "cron: unsaved-photo cleanup skipped (Supabase not configured)",
      );
      return;
    }
    const result = await deleteUnsavedUploads({
      bucket: env.MENU_BUCKET,
      supabaseUrl: env.SUPABASE_URL,
      secretKey: env.SUPABASE_SECRET_KEY,
      now,
    });
    console.log(
      `cron: unsaved-photo cleanup scanned ${result.scanned}, deleted ${result.deleted.length}`,
      result.deleted,
    );
  },
} satisfies ExportedHandler<Env>;
