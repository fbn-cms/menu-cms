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
  Done: `worker.ts` `scheduled()` → 03:00 Toronto deletes **unsaved uploads only** (R2 image
  files > 24 h old that no dish/category/logo uses). Owner decision 2026-10-19: replaced or
  removed photos are **kept**; `image_deletions` is treated as a keep-list, never emptied.
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
- [x] **Phase 3** — public menu + i18n/RTL, search/filters, live availability, JSON-LD, hreflang. 18 Playwright tests (incl. RTL overflow at 360px and live sell-out re-sort). **Lighthouse mobile on live demo (3 runs): /en/menu 99/100/100/100, /fa/menu 98–100/100/100/100, CLS 0**
  - Realtime uses a PRIVATE broadcast channel (public channels let any client send fake updates)
  - Fonts: next/font self-hosts Geist + Vazirmatn from our origin (spec said R2; same effect, simpler)
  - OG image per item = its hero photo when present (next/og image generation would exceed the 10 ms CPU limit)
  - Worker bundle 1.8 MiB gzip (limit 3 MiB on Free) — watch this
  - CSS is inlined (experimental.inlineCss) for first-visit speed → CSP will need style-src 'unsafe-inline' (script-src stays strict)
  - Fonts use display:optional (zero layout shift); no Zod in browser code (saved ~100 KB gz)
  - Demo deployed 2026-10-11: https://menu-demo.fbn-cms-managment.workers.dev (manual `opennextjs-cloudflare deploy --env demo` until CI in Phase 7)
  - TODO later: variant name translations; design/CSS polish pass
- [x] **Phase 4 (local)** — email+password AND magic-link sign-in (owner decision), invite-only, set/forgot password, middleware guard, role nav (staff: 86 board only), 86 board (2 taps, optimistic, stale-write refusal, until presets incl. DST), reset-all, team invites/roles/deactivate (+auth ban), audit log page. 18 admin e2e tests ×2 viewports
  - middleware.ts (edge) instead of Next 16 proxy.ts: OpenNext's Node-proxy support is experimental
  - Supabase: [auth.email] enable_signup must stay TRUE (it is the email provider switch); sign-ups are blocked by [auth] enable_signup=false
  - Hosted auth config + first accounts: scripts/configure-supabase-auth.mjs, scripts/bootstrap-team.mjs
- [x] **Appearance settings (owner request, 2026-10-13)** — /admin/settings (owner only): name, show-name toggle, logo upload (browser resize → WebP → /api/admin/images → R2, content-hashed key), 5 palettes + custom background/text/accent. All other colours derived; contrast enforced (text ≥ 7:1, accent ≥ 3:1, button text ≥ 4.5:1). Live preview. Applied to public pages via CSS variables. 3 e2e tests
- [x] **Header/footer (owner request, 2026-10-13)** — language row above logo+name; hidden "Staff login" after 5 quick taps on the brand (session only); footer with address (maps link), phone (tel: link) and "© year holder. All rights reserved." (holder editable in Settings, defaults to the name). RTL fix: restaurant-written text uses `unicode-bidi: plaintext` (Tailwind v4 needs `@utility`, not `@layer utilities`)
- [x] **Phase 5** — Dishes (list: search, category/status filters, missing-translation filter, EN/FA/FR indicator, bulk show/hide, ↑↓ reorder per category; editor: photos, text in 3 languages with RTL input, price, prep, calories, spice, sizes/options with own prices, labels, publish/feature, slug, delete, stale-save refusal, unsaved-changes warning), Categories (CRUD, translations, ↑↓ reorder, publish, delete guarded when not empty; empty ones hidden from guests), Labels (dietary/allergen/highlight, translations, 47-icon catalogue with automatic suggestion from EN/FR/FA text). Image pipeline: in-browser crop (drag + zoom) → 400×400 icon / 1600×1200 hero WebP + 24px LQIP → R2 via route handler; server sniffs bytes, 2 MB cap, dimension check; replaced/deleted photos queued for nightly cleanup. All saves are single-transaction RPCs (SECURITY INVOKER → RLS) with 16 new pgTAP tests and 8 new e2e flows
  - Reorder uses ↑/↓ buttons (works on touch, keyboard, screen reader) instead of drag-and-drop (would need an extra library)
  - Not done: per-option (variant) name translations — options show their English name in all languages
- [x] **Owner requests 2026-10-14** — Chef's pick moved to the 86 board (pink 4th button; staff boundary widened by exactly `is_featured`, audited, live). AI in the dish editor on Cloudflare Workers AI (free 10k neurons/day, `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, configurable via `AI_TEXT_MODEL`): "Write with AI" (EN descriptions from name + notes, never invents allergens) and "Translate to Persian & French" (fills FA/FR + option names, flagged "Machine-translated" until reviewed; nothing saved until Save). Option names now translatable. AI binding only in deployed envs (no local emulator); AI_FAKE=1 locally/e2e
- [x] **External AI keys (owner request 2026-10-14)** — Settings → AI (owner only): add/replace/remove an Anthropic (Claude) and/or OpenAI (ChatGPT) API key, pick provider + model, free Cloudflare AI as fallback. Keys validated with the provider before saving, stored AES-256-GCM encrypted with the `AI_KEYS_SECRET` Worker secret (bound to restaurant+provider), `ai_settings` table has RLS with no policies (unreadable via API by any role, owner included), not in the generic audit trigger (explicit audit rows without keys), browser only ever sees the last 4 characters. Dish editor: one "Generate from <tab language>" — type the dish in EN, FA or FR; AI writes missing descriptions there and fills the other two languages + option names; own text never overwritten unless "Replace" ticked; flagged "Written by AI" until reviewed. Claude via the official Anthropic SDK (structured output, server-side refusal fallback on Opus/Sonnet 5.5); ChatGPT via the Responses API (strict JSON schema)
- [x] **Hosting plan (2026-10-14)** — Workers Free's 10 ms CPU limit killed/hung page renders (see LIMITS.md correction). Owner upgraded to **Workers Paid ($5/mo)**; verified fixed; per-request CPU capped at 5 s
- [ ] **Phase 6** — QR (single code, level H), `/t/[slug]` scan logging (no bulk print on workers.dev)
- [ ] **Phase 7** — rate limits, headers/CSP, cron dispatcher, backups, CI/CD demo+prod, RUNBOOK, HANDOVER
- [ ] **Later** — design/CSS polish pass, custom domain migration (§11)
