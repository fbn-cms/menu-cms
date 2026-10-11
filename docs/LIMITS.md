# Free-tier limits & versions

_Last checked: 2026-10-11. Re-check before go-live; providers change these._

## Package versions (npm, 2026-10-11)

| Package                | Latest                               | Notes                                                                                                                                                     |
| ---------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| next                   | **16.3.8 pinned** (16.4.0 is latest) | 16.4 breaks OpenNext 1.20.10 at runtime (`preview-props.json` loadManifest error, opennextjs-cloudflare#1355/#1356). Upgrade when a fixed OpenNext ships. |
| @opennextjs/cloudflare | 1.20.10                              | requires wrangler ^4.148                                                                                                                                  |
| wrangler               | 4.149.0                              |                                                                                                                                                           |
| @supabase/supabase-js  | 2.117.3                              |                                                                                                                                                           |
| @supabase/ssr          | 0.12.7                               | cookie-based auth for App Router                                                                                                                          |
| supabase (CLI)         | 2.120.0                              | run via `npx`, local stack needs Docker                                                                                                                   |
| tailwindcss            | 4.3.3                                | shadcn/ui supports v4                                                                                                                                     |
| zod                    | 4.6.5                                |                                                                                                                                                           |
| qrcode                 | 1.5.4                                |                                                                                                                                                           |
| vitest                 | 5.0.3                                |                                                                                                                                                           |
| @playwright/test       | 1.64.0                               |                                                                                                                                                           |

## Cloudflare Workers — Free

Source: developers.cloudflare.com/workers/platform/limits

| Limit            | Value                                                                                                                                    | What happens when hit / our mitigation                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requests         | 100,000 / day (resets 00:00 UTC)                                                                                                         | Further requests error (1027) until reset. One restaurant ≈ a few thousand/day. Static assets served from Workers Assets don't count as Worker invocations.                         |
| CPU per request  | **10 ms** (prompt assumed 30 ms)                                                                                                         | Request fails with 1102. Mitigation: public pages are ISR-cached; no heavy SSR per hit; images pre-resized in browser. I/O wait does not count as CPU.                              |
| CPU per cron run | 10 ms                                                                                                                                    | Crons only do I/O (SQL calls, R2 deletes), so fine.                                                                                                                                 |
| Cron triggers    | **5 per account**                                                                                                                        | We have 2 Workers (demo + prod) × 3 jobs = 6 → too many. Mitigation: **1 hourly cron per Worker** that dispatches all jobs (keep-alive, 4am-local expiry, orphan cleanup). Total 2. |
| Subrequests      | 50 / request                                                                                                                             | Fine.                                                                                                                                                                               |
| Worker size      | Cloudflare docs: 64 MiB uncompressed. OpenNext docs: 3 MiB gzip on Free. **Measured Phase 1: 4.6 MiB raw / 0.99 MiB gzip** — under both. | If over: deploy fails. Keep server deps lean; re-measure each phase (`wrangler deploy --dry-run`).                                                                                  |
| Static assets    | 20,000 files, 25 MiB each                                                                                                                | Fine.                                                                                                                                                                               |

## Next.js cache on Cloudflare (changed from spec)

Spec said "KV incremental cache". OpenNext now **recommends against KV** (eventually consistent)
and on-demand `revalidateTag` needs a tag cache. We use, all on the Free plan:

| Piece                       | Service                         | Free limit                                 |
| --------------------------- | ------------------------------- | ------------------------------------------ |
| Incremental cache           | R2 bucket `menu-<env>-cache`    | shares R2 limits below                     |
| Tag cache (`revalidateTag`) | D1 `menu-<env>-tags`            | 5 M rows read / 100k written per day, 5 GB |
| Revalidation queue          | Durable Object (SQLite backend) | 100k requests/day, 13,000 GB-s/day, 5 GB   |

## Cloudflare KV — Free (not currently used)

| Limit   | Value                                            | Impact                                                                                                                    |
| ------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Reads   | 100,000 / day                                    | Cache reads per page view.                                                                                                |
| Writes  | **1,000 / day** (different keys); 1/sec same key | Each revalidation writes a few keys. Fine for normal editing; a bulk import of hundreds of items in one day could hit it. |
| Storage | 1 GB                                             | Fine.                                                                                                                     |

## Cloudflare R2 — Free (images, fonts, backups)

| Limit                  | Value        | Impact                                                                                          |
| ---------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| Storage                | 10 GB-month  | ~100 KB per item (icon+hero) → tens of thousands of items. Backups (30 days × 2 DBs) are small. |
| Class A (writes/lists) | 1 M / month  | Fine.                                                                                           |
| Class B (reads)        | 10 M / month | Edge cache absorbs most reads (immutable keys).                                                 |
| Egress                 | Free         | —                                                                                               |

## Supabase — Free

Source: supabase.com/pricing

| Limit            | Value                                                                                                      | What happens / mitigation                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Active projects  | **2**                                                                                                      | We use both: `menu-demo` and `menu-prod`. No spare slot for anything else on this account.                      |
| Inactivity pause | after 1 week                                                                                               | Paused = site has no data. Mitigation: hourly cron does `select 1` via `/api/health` on **each** project.       |
| DB size          | 500 MB                                                                                                     | Menu data is tiny; `scan_events` is the only growing table → prune rows > 1 year old.                           |
| Egress           | 5 GB (+5 GB cached)                                                                                        | Images are on R2, not Supabase. Menu JSON is ISR-cached.                                                        |
| MAU (auth)       | 50,000                                                                                                     | Only staff sign in; diners are anonymous.                                                                       |
| Realtime         | 200 concurrent connections, 2 M messages/month                                                             | 200 diners with the menu open at once. Over that → new sockets refused; page falls back to revalidate-on-focus. |
| Backups          | **None**                                                                                                   | Nightly `pg_dump` → R2 via GitHub Actions, 30-day retention (Phase 7).                                          |
| Commercial use   | Not stated on pricing page; widely reported as allowed. **Unverified against ToS — owner should confirm.** |                                                                                                                 |

## GitHub Actions

Free for public repos; private repos get 2,000 min/month on Free. Our CI (~5 min/run) + nightly backup (~1 min) fits comfortably.

## Fonts

Vazirmatn — SIL OFL 1.1, commercial use OK; ship OFL.txt alongside the font files. Self-hosted.

## npm audit (2026-10-11)

13 "high" advisories, all in build-time tooling (glob CLI, braces/micromatch via eslint, shadcn CLI,
OpenNext's minifier). None are bundled into the deployed Worker. Re-check at each phase.
