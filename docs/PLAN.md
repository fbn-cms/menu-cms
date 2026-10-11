# Plan — QR Restaurant Menu + CMS

Source spec: `restaurant-qr-menu-BUILD-PROMPT.md` (root). This file records the decisions
taken in Phase 0 and the build checklist.

## Decisions (Phase 0, 2026-10-11)

| Topic        | Decision                                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Restaurant   | Placeholder **"Demo Bistro", Toronto** (CAD, America/Toronto) — editable in settings                                                                           |
| Scope        | Display-only menu, single restaurant, multi-tenant-ready schema                                                                                                |
| Locales      | en (default), fa (RTL), fr. Persian digits default Western                                                                                                     |
| Roles        | **owner, admin, staff** — `viewer` dropped. 1 owner, 1 admin, a few staff                                                                                      |
| Diners       | Anonymous, no sign-up, read-only published content (RLS `anon` role)                                                                                           |
| QR           | **One restaurant-wide QR** (`/t/main`); schema still supports per-table later                                                                                  |
| Content      | Seed data (~3 categories, ~12 items); real menu entered via CMS later                                                                                          |
| Environments | **demo** and **prod**, fully isolated: 2 Supabase projects, 2 Workers, 2 R2 buckets, 2 KV namespaces                                                           |
| Framework    | **Next.js 16.3.8** (owner approved 16 over spec's 15.x; held at 16.3 until OpenNext supports 16.4). `cacheComponents` off. `proxy.ts` replaces `middleware.ts` |
| Next cache   | R2 incremental cache + D1 tag cache + DO queue (spec said KV; see LIMITS.md)                                                                                   |
| UI           | shadcn/ui (radix-nova preset, RTL enabled), lucide icons                                                                                                       |
| Migrations   | Supabase CLI plain-SQL migrations (`supabase/migrations`), `supabase-js` for queries, **pgTAP** for RLS tests. No Drizzle                                      |
| Local dev    | `npx supabase start` (Docker) — full stack locally, no cloud accounts needed for Phases 1–3                                                                    |

## Environments

```
            local                     demo                          prod
Worker      next dev / wrangler dev   menu-demo.<acct>.workers.dev  menu-prod.<acct>.workers.dev → custom domain later
Supabase    Docker (supabase start)   project "menu-demo"           project "menu-prod"
R2          local (miniflare)         menu-demo-images              menu-prod-images
Cache R2    local                     menu-demo-cache               menu-prod-cache
Tag D1      local                     menu-demo-tags                menu-prod-tags
Data        seed                      seed, reset freely            real menu
Deploy      —                         auto on merge to main         manual workflow_dispatch (+ approval)
```

`wrangler.jsonc` uses `env.demo` / `env.production` blocks; `NEXT_PUBLIC_SITE_URL` differs per env.

## Architecture

- **Next.js on Workers** via `@opennextjs/cloudflare`. Public pages ISR (R2 cache, D1 tags); admin writes call `revalidateTag('restaurant:<id>')`.
- **Supabase**: Postgres + Auth (magic link) + RLS + Realtime on `items`.
- **Ordering rule** lives in one SQL view `public_menu_items` (availability → sort_order → name);
  every diner read path uses it. Client re-applies the same comparator after Realtime updates.
- **Staff column lock**: `BEFORE UPDATE` trigger on `items` + column-level GRANT. Audit trigger
  on every write.
- **Images**: browser resize (OffscreenCanvas → WebP) → route handler → R2 binding →
  served by `/img/[...key]` with immutable caching.
- **Crons**: a single hourly trigger per Worker dispatching: keep-alive (every run),
  availability expiry (at 04:00 restaurant-local), orphan image cleanup (03:00 local).
- **Backups**: GitHub Action nightly `pg_dump` of each DB → R2, 30-day retention.

## Open questions (need your answer before / during the phases)

1. ~~Next.js 15 vs 16~~ → decided: 16.
2. ~~GitHub (G1)~~ → `https://github.com/fbn-cms/menu-cms` (gh installed).
3. Offline service worker and Sentry: **off** (can add later).
4. Commercial use on Supabase Free — please skim their ToS once (I couldn't verify on the official page).

## External resources you will need to create (asked at the gates, not now)

- G1 GitHub repo (private)
- G3 Cloudflare account (free) → account ID + API token with: Workers Scripts:Edit,
  Workers KV Storage:Edit, Workers R2 Storage:Edit, Account Settings:Read
  (+ Zone:DNS:Edit only when a custom domain is added)
- G2 Two Supabase projects (demo, prod) → URL, anon key, service-role key, DB connection string each
- G6 Your owner email + admin/staff emails
- G7 Go-live confirmation

## Checklist

- [x] **Phase 0** — questions, LIMITS.md, PLAN.md
- [x] **Phase 1** — scaffold Next + TS strict + Tailwind + shadcn, OpenNext, wrangler envs, ESLint/Prettier/Vitest/Playwright, pre-commit; `dev` and `preview` boot. Measure bundle size.
- [x] **Phase 2 (local)** — migrations, RLS, triggers, RPCs, seed, 54 pgTAP tests green. See docs/SECURITY.md
- [x] **Phase 2 (remote)** — 2026-10-11: demo = migrations + seed, 54/54 tests pass on live DB; prod = migrations only (0 rows, 37 policies, RLS on all tables). Both in ca-central-1, Postgres 17.11
- [ ] Supabase dashboard (owner): disable public sign-ups on both projects; set Site URL once the workers.dev URL exists
- [ ] **Phase 3** — public menu + i18n/RTL, search/filters, realtime, JSON-LD/OG, Lighthouse
- [ ] **Phase 4** — magic-link auth, profiles bootstrap, middleware, role nav, 86 board, audit
- [ ] **Phase 5** — item/category editors, image pipeline, reorder, bulk, concurrency, revalidation
- [ ] **Phase 6** — QR (single code, level H), `/t/[slug]` scan logging (no bulk print on workers.dev)
- [ ] **Phase 7** — rate limits, headers/CSP, cron dispatcher, backups, CI/CD demo+prod, RUNBOOK, HANDOVER
- [ ] **Later** — design/CSS polish pass, custom domain migration (§11)
