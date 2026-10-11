# BUILD PROMPT — QR Restaurant Menu + Lightweight CMS

> Paste this whole file into Claude Code as the opening message.
> Fill in **Section 0** first. Everything below Section 0 is instructions to the agent.

---

## 0. PROJECT ANSWERS (fill these in before pasting)

```yaml
restaurant_name:        "____"                   # TODO
restaurant_city:        "____"                   # TODO
scope:                  "display-only menu"      # DECIDED: no cart, no payments
tenancy:                "single restaurant"      # DECIDED: schema stays multi-tenant-ready
languages:              ["en", "fa", "fr"]       # DECIDED: en default, fa is RTL
default_locale:         "en"
domain:                 "workers.dev for now, custom domain after demo"   # DECIDED — see §11
staff_count:            "____"                   # TODO
per_table_qr:           "____"                   # TODO (true = each table gets its own QR)
menu_size:              "____ items / ____ categories"   # TODO
existing_menu_source:   "____"                   # TODO: PDF / Excel / photos / none
needs_image_cropping:   true
dietary_tags_needed:    true                     # vegan, halal, gluten-free, spice level
allergen_declarations:  true
prices_shown:           true
```

Fields marked TODO are still open. **Ask me about every one of them in Phase 0 before writing
code.** The DECIDED fields are settled — do not reopen them.

---

## 1. ROLE AND MISSION

You are the sole engineer building and deploying a production restaurant menu web app.

A diner scans a QR code on the table → opens a fast mobile web page → sees the full menu
grouped by category → each item shows a thumbnail icon, name, price, and a live
availability badge → tapping an item opens a full detail page with a large hero image and
full description.

Behind it sits a lightweight CMS where restaurant staff manage everything through role-based
access. No WordPress, no Strapi, no external CMS service. The CMS is part of this app.

**Non-negotiable constraints:**

1. **Zero recurring software cost.** Every service must be on a free tier that permits
   **commercial** use. A restaurant is a commercial entity.
2. **Production-grade**, not a prototype: real auth, real RLS, real backups, real CI/CD,
   real monitoring, HTTPS, no secrets in the client bundle.
3. **Mobile-first.** The primary device is a phone on restaurant wifi or LTE. Menu list must
   be interactive in under 2s on a mid-range Android over 4G.
4. **Staff-proof admin.** A server must be able to mark a dish "sold out" in under 3 taps
   on their phone without being able to break anything else.

---

## 2. STACK (pinned — do not substitute without asking me)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15.x, App Router, TypeScript, strict mode | best-supported full-stack React |
| Styling | Tailwind CSS + shadcn/ui | fast, accessible primitives |
| Hosting | **Cloudflare Workers** via `@opennextjs/cloudflare` | free tier allows commercial use, no inactivity pause, global CDN |
| Database + Auth | **Supabase** (Postgres + Auth + Row Level Security) | free tier permits commercial use; RLS gives real per-role security |
| Image storage | **Cloudflare R2** (bound directly to the Worker) | 10 GB free, **zero egress fees**, already behind Cloudflare's CDN |
| ORM / queries | `@supabase/supabase-js` + `postgres-js` for migrations; or Drizzle if you prefer typed migrations — pick one and stay consistent | |
| Validation | Zod on every server boundary | |
| CI/CD | GitHub Actions → `wrangler deploy` | free |
| Errors | Sentry free tier (optional, ask me first) | |

### Critical "why not" notes — do not undo these decisions

- **Do NOT deploy to Vercel.** Vercel's Hobby (free) plan terms restrict it to personal,
  non-commercial use. A restaurant menu is commercial use. Cloudflare's free tier carries no
  such restriction.
- **Do NOT put images in Supabase Storage.** Supabase free gives 1 GB storage but only
  ~5 GB/month egress. Hero images would burn that. R2 has zero egress cost. Images go to R2.
- **Do NOT use Cloudflare Images or Image Resizing.** Those are paid. Resize in the browser
  before upload (see §6).
- **Do NOT use `next/image` default loader on Workers** — it needs `sharp`, which does not
  run in the Workers runtime. Use plain `<img>` with pre-generated renditions, explicit
  `width`/`height`, `loading="lazy"`, and `decoding="async"`.

### Known free-tier ceilings — design within them, and write them into `docs/LIMITS.md`

- Cloudflare Workers free: ~100,000 requests/day, 30 ms CPU per request (plenty for this),
  10 ms is a realistic target.
- Cloudflare R2 free: 10 GB storage, 1M Class A ops/month, 10M Class B ops/month.
- Supabase free: 500 MB database, 50,000 MAU, **projects pause after 7 days of inactivity**.
  → Mitigate with a Cloudflare Cron Trigger that pings a `/api/health` endpoint daily, which
  performs one trivial `select 1` against Postgres. Build this in Phase 7, it is mandatory.
- Supabase free allows only 2 active projects per account. We need 1 (or 2 if you want a
  separate staging DB — ask me).

Before installing, **verify current versions and current free-tier limits** rather than
trusting the numbers above. Record what you find in `docs/LIMITS.md` with the date checked.

---

## 3. DATA MODEL

Write this as SQL migrations in `supabase/migrations/`. Every table gets `created_at`,
`updated_at`, and RLS enabled. Nothing is readable or writable without an explicit policy.

```
restaurants      id, name, slug, logo_key, currency, timezone, locale,
                 default_locale, theme_json, address, phone, hours_json,
                 banner_message, is_published

categories       id, restaurant_id → restaurants, name, slug, description,
                 icon_key, sort_order, is_published

items            id, restaurant_id, category_id → categories,
                 name, slug, short_description, long_description,
                 price_cents, currency,
                 icon_key, hero_key,                    -- R2 object keys, content-hashed
                 availability,                          -- enum: available | limited | unavailable
                 remaining_qty         int null,        -- optional countdown for 'limited'
                 availability_note     text null,       -- "last 3 portions tonight"
                 availability_until    timestamptz null,-- auto-reverts after this time
                 prep_minutes, calories, spice_level,
                 is_featured, is_published, sort_order,
                 updated_by → profiles
                 UNIQUE (restaurant_id, slug)

item_variants    id, item_id, name, price_delta_cents, availability, sort_order
                 -- sizes/portions: "Small" / "Large", "Half tray" / "Full tray"

tags             id, restaurant_id, label, kind (dietary|feature|allergen), icon
item_tags        item_id, tag_id                        -- vegan, halal, gluten-free, chef's pick

item_translations      item_id, locale, name, short_description, long_description,
                       availability_note
                       PRIMARY KEY (item_id, locale)
category_translations  category_id, locale, name, description
tag_translations       tag_id, locale, label
                       -- locales: 'en' (default/fallback), 'fa' (RTL), 'fr'
                       -- base-table columns hold the 'en' text; translations override.
                       -- Missing translation falls back to 'en' and is flagged in admin,
                       -- never rendered as an empty string.

profiles         id → auth.users, restaurant_id, full_name, role, is_active
                 -- role enum: owner | admin | staff | viewer
                 -- owner  = everything, incl. settings and user management
                 -- admin  = full menu editing, no settings, no user management
                 -- staff  = availability toggles ONLY (4 columns, see matrix below)
                 -- viewer = read-only admin; drop this role if I say I don't need it

qr_codes         id, restaurant_id, label, table_number, target_path, slug,
                 is_active, created_at
scan_events      id, qr_code_id, occurred_at, ua_family, is_bot
                 -- keep minimal; no IPs, no cookies, no personal data

audit_log        id, actor_id, action, entity, entity_id,
                 before_json, after_json, occurred_at
```

### Availability semantics — this is the core feature, get it exactly right

Three states, rendered distinctly on both list and detail pages:

- `available` — normal.
- `limited` — "Limited availability". Shows `availability_note` and, if `remaining_qty` is
  set and > 0, shows the count. Visually warm/amber, not alarming.
- `unavailable` — "Sold out today". Item stays **visible** on the menu (diners want to know
  what the restaurant normally serves) but is visibly dimmed, de-emphasized, moved to the
  bottom of its category, and its detail page says so at the top. It is never silently hidden.

**Ordering rule — applies to every list the diner sees, on every page:**

Within each category, items sort by availability first, then by the admin's manual
`sort_order`, then by name. Never the other way around.

```sql
ORDER BY
  CASE availability
    WHEN 'available'   THEN 0
    WHEN 'limited'     THEN 1
    WHEN 'unavailable' THEN 2
  END,
  sort_order,
  name
```

So a diner scrolling a category sees everything they can actually order first, then what is
running low, then what is gone. Sold-out items sink to the bottom of their own category — they
do **not** get collected into one "sold out" section at the bottom of the whole menu, because
that breaks the category browsing model.

Implement this as a database view or a shared query helper used by every read path, so it
cannot drift between the menu list, the category page, and the search results. Write a test
that asserts it. Note that the sort must be recomputed when Realtime flips an item's state —
when a dish sells out while a diner has the page open, it should animate down to the bottom of
its category rather than staying put or jumping without explanation.

`availability_until` lets staff set "sold out until tomorrow"; a scheduled job (Cloudflare
Cron, daily at the restaurant's local 4am) reverts expired overrides back to `available` and
clears `remaining_qty`. Include this job.

`is_published = false` is a separate concept: that hides the item entirely (seasonal item not
on the menu at all). Do not conflate publishing with availability.

### Role permission matrix — implement as RLS policies, not as UI-only checks

| Action | owner | admin | staff | viewer |
|---|---|---|---|---|
| Sign in to admin | ✅ | ✅ | ✅ | ✅ |
| **Set availability (available / limited / sold out)** | ✅ | ✅ | **✅** | ❌ |
| **Set availability note, remaining qty, "until"** | ✅ | ✅ | **✅** | ❌ |
| Create / edit / delete items | ✅ | ✅ | ❌ | ❌ |
| Create / edit / delete categories, reorder | ✅ | ✅ | ❌ | ❌ |
| Change prices or variants | ✅ | ✅ | ❌ | ❌ |
| Upload / replace / crop images | ✅ | ✅ | ❌ | ❌ |
| Edit descriptions and translations | ✅ | ✅ | ❌ | ❌ |
| Edit tags, allergens, dietary flags | ✅ | ✅ | ❌ | ❌ |
| Publish / unpublish items | ✅ | ✅ | ❌ | ❌ |
| Generate / manage QR codes | ✅ | ✅ | ❌ | ❌ |
| Restaurant settings, hours, branding | ✅ | ❌ | ❌ | ❌ |
| Invite users / change roles / deactivate | ✅ | ❌ | ❌ | ❌ |
| View audit log | ✅ | ❌ | ❌ | ❌ |

`staff` is a **strictly** availability-only role. The entire set of columns a staff user may
ever write is: `availability`, `availability_note`, `remaining_qty`, `availability_until`.
Nothing else on `items`, and no write at all to any other table. A staff user signing in lands
directly on `/admin/availability` and sees no other navigation.

### Enforcing this correctly — read before writing the policies

**Postgres RLS is row-level, not column-level.** A naive `USING`/`WITH CHECK` policy that lets
staff update `items` lets them update *every column* of any row they can reach, including
`price_cents`. The UI hiding the price field is not a security control. Enforce with **both**
of these, not one:

1. A `BEFORE UPDATE` trigger on `items` that, when the caller's role is `staff`, compares OLD
   and NEW and raises an exception if any column outside the four allowed ones changed. This
   is the real boundary and it cannot be bypassed from the client.
2. Column-level `GRANT UPDATE (availability, availability_note, remaining_qty,
   availability_until) ON items` for the staff role, as defence in depth.

Then write SQL tests that authenticate as each role and assert, at minimum:

- a `staff` JWT **can** flip `availability` and set a note;
- a `staff` JWT updating `price_cents` is **rejected at the database**, not merely hidden;
- a `staff` JWT cannot `INSERT` or `DELETE` on `items`, `categories`, or `item_translations`;
- an `admin` JWT cannot write `restaurants` settings or `profiles`;
- a `viewer` JWT cannot write anything;
- an anonymous request cannot read `profiles`, `audit_log`, or unpublished rows.

These tests are part of the Phase 2 acceptance criteria. Do not move to Phase 3 until they pass.

Every availability change — including staff ones — writes an `audit_log` row recording who
changed what and when, so the owner can see who 86'd a dish and at what time.

Public (anonymous) read: `SELECT` only, only rows where `is_published = true` and the parent
category and restaurant are published. Nothing else. No anon access to `profiles`,
`audit_log`, or `scan_events`.

---

## 4. PUBLIC MENU — PAGES AND BEHAVIOUR

```
/                          → detect locale, redirect to /[locale]/menu
/[locale]/menu             → all categories, sticky category nav, search, dietary filters
/[locale]/menu/[category]  → single category
/[locale]/item/[slug]      → full item page: hero image, long description, variants,
                             tags, allergens, prep time, availability banner
/t/[qr-slug]               → QR landing: records a scan event, sets table context,
                             → /[locale]/menu
/admin/*                   → CMS (see §5), admin chrome in English only
/api/health                → cheap DB ping for the keep-alive cron
```

`locale` ∈ `en | fa | fr`. Item slugs stay in the base (English) locale across all three so a
URL is portable between languages; only the display text changes.

### Internationalisation — EN / FA / FR, with Persian right-to-left

This is a real requirement, not a nice-to-have. Build it in from Phase 3, not bolted on later.

- **Routing:** locale-prefixed paths as above. Detect from `Accept-Language` on first visit,
  then persist the choice in `localStorage` (not a cookie — keeps us out of consent-banner
  territory). A visible language switcher sits in the header on every public page and
  preserves the current path when switching.
- **Direction:** set `dir="rtl"` and `lang="fa"` on `<html>` for Persian. Write **all** layout
  CSS with logical properties — `margin-inline-start`, `padding-inline-end`, `inset-inline`,
  `text-align: start` — never `left`/`right`. Tailwind: use `ps-*` / `pe-*` / `ms-*` / `me-*`
  and `start-*` / `end-*`, never `pl-*` / `pr-*`. Mirror directional icons (back arrows,
  chevrons) under RTL; do **not** mirror the logo, images, or the QR code.
- **Fonts:** a Latin face for en/fr plus a Persian face with full Arabic-script coverage
  (Vazirmatn is the usual free choice — verify its licence permits commercial use and
  self-host the subset from R2 rather than hotlinking a CDN).
- **Numbers and prices:** use `Intl.NumberFormat` per locale. Offer a per-restaurant setting
  for whether Persian renders Western (123) or Eastern Arabic (۱۲۳) digits — default to
  Western, which is what Canadian Persian-speaking diners generally expect. Currency symbol
  placement follows the locale, not a hardcoded template.
- **Fallback:** if an item has no `fa` translation, render the `en` text rather than a blank.
  Never machine-translate silently. Never show an empty field.
- **Testing:** Playwright must assert RTL layout on `/fa/menu` — specifically that the sticky
  category nav scrolls the correct way and that no element overflows the viewport at 360px.

Requirements:

- **Menu list**: icon thumbnail (square, ~80px rendered), name, short description (2 lines,
  clamped), price, availability badge. Sticky horizontal category chips that scroll-spy.
  Items within each category are ordered available → limited → sold out, per the ordering rule
  in §3. This is the default on every list; the "available now" filter is an additional control
  on top of it, not a replacement for it.
- **Search + filter** client-side over the already-loaded menu JSON — no round trip.
  Filters: dietary tags, "available now" toggle, price range.
- **Item page**: large hero image with a blurred-placeholder or solid-color LQIP to avoid
  layout shift, full description, variants with their own prices and availability, allergen
  list, tags, back-to-category link, and a prominent availability banner when not `available`.
- **Live updates**: subscribe to Supabase Realtime on the `items` table so an open menu page
  flips a dish to "Sold out" without a refresh. Degrade gracefully if the socket fails —
  fall back to revalidating on tab focus.
- **Rendering**: public pages are statically rendered with ISR. Use the OpenNext KV
  incremental cache. On any admin write, call `revalidateTag` for the affected restaurant so
  changes appear within seconds, not minutes.
- **Offline/poor signal**: a service worker caching the menu shell and the last-seen menu JSON
  is a nice-to-have — restaurant basements have bad reception. Flag it to me as optional scope.
- **SEO + sharing**: proper `<title>`, meta description, JSON-LD `Restaurant` + `Menu`
  schema.org markup, Open Graph image per item.
- **Accessibility**: WCAG 2.1 AA. Availability must never be communicated by colour alone —
  always pair with text and an icon. Target ≥44px touch targets. Test with a screen reader.
- **No cookie banner needed** — do not add analytics that set cookies or collect personal
  data. Scan counting is anonymous and aggregate only.

---

## 5. ADMIN CMS — PAGES AND BEHAVIOUR

```
/admin/login               → Supabase Auth, email magic link (no passwords to leak)
/admin                     → dashboard: today's sold-out list, recent changes, scan count
/admin/availability        → THE "86 BOARD" — see below
/admin/items               → list, search, filter, bulk publish/unpublish, reorder
/admin/items/[id]          → full editor incl. image upload for icon + hero
/admin/categories          → CRUD + drag-to-reorder
/admin/qr                  → generate / download / print QR codes
/admin/users               → owner only: invite, assign role, deactivate
/admin/settings            → owner only: branding, hours, currency, banner
/admin/audit               → owner only
```

**The 86 board (`/admin/availability`) is the most-used screen in the app.** Design it for a
server holding a phone in one hand mid-shift:

- Every item in one scrollable list, grouped by category, with a 3-state segmented control
  (Available / Limited / Sold out) inline. One tap to change. Optimistic UI, instant.
- Choosing "Limited" or "Sold out" opens a small sheet for an optional note, optional
  remaining quantity, and an "until" selector (rest of service / tonight / until I change it).
- A persistent "Reset all to available" action, owner/manager only, with confirmation.
- Must work one-handed, and must be usable on a cracked 5" phone in bad lighting.

Other admin requirements:

- **Translation editing:** the item and category editors show a language tab strip
  (EN / FA / FR). English is required to save; Persian and French are optional. The item list
  shows a small completeness indicator per row (e.g. `EN FA ·` = French missing) so the owner
  can see at a glance what still needs translating. Persian fields render in an RTL input.
  Add an admin filter for "missing translations".
- Image upload UI: drag-drop or camera capture, square crop for the icon, 4:3 or 16:9 crop
  for the hero, live preview of both before saving, and a clear "replace image" flow on items
  that already have one.
- Every destructive action gets a confirm dialog and writes to `audit_log`.
- Optimistic concurrency: if two staff edit the same item, the second save warns rather than
  silently overwriting (compare `updated_at`).
- Admin routes are protected in middleware **and** by RLS. Never rely on the client.

---

## 6. IMAGE PIPELINE (free-tier safe — follow exactly)

1. **Resize in the browser before upload.** Use `createImageBitmap` + `OffscreenCanvas`.
   Produce two WebP renditions per item:
   - `icon`: 400×400, center-cropped from the user's crop box, quality ~0.80
   - `hero`: max 1600px on the long edge, quality ~0.82
   Reject anything that still exceeds 600 KB after encoding and ask the user to re-crop.
   Also emit a 24px-wide base64 LQIP string, stored on the row, for placeholder rendering.
2. **Upload through a Next.js route handler** that writes straight to the R2 binding
   (`env.MENU_BUCKET.put(key, body)` via `getCloudflareContext()`). No S3 SDK, no presigned
   URLs, no `aws4fetch` — the binding is simpler and has no credentials to leak.
3. **Key format:** `{restaurant_id}/{item_id}/{icon|hero}-{contenthash}.webp`.
   Content-hashed keys make every object immutable, so you can cache forever and never fight
   stale images after a replace.
4. **Serve** via a route handler `/img/[...key]` that reads from the R2 binding and returns
   `Cache-Control: public, max-age=31536000, immutable`. Cloudflare's CDN caches it at the
   edge. Optionally bind a custom R2 subdomain later — do not block on it.
5. **Orphan cleanup:** when an image is replaced or an item deleted, enqueue the old key for
   deletion in a nightly cron. Never delete synchronously inside a user request.
6. Validate server-side: content type sniffing (not just the filename), max 2 MB hard cap,
   dimension sanity check. Reject SVG entirely.

---

## 7. BUILD PHASES — WORK IN THIS ORDER

Do not skip ahead. At the end of each phase, run the acceptance checks, commit, and tell me
what you did in 3 lines or fewer.

### Phase 0 — Confirm and plan
Read Section 0. Ask me about anything blank or contradictory. Verify current package versions
and free-tier limits with a web search; write findings to `docs/LIMITS.md`. Produce
`docs/PLAN.md` with the final architecture and a checklist. **Wait for my go-ahead.**

### Phase 1 — Repo and scaffold
Scaffold Next.js 15 + TS strict + Tailwind + shadcn/ui. Add `@opennextjs/cloudflare` and
`wrangler`. Configure `wrangler.jsonc` with `nodejs_compat`, the R2 bucket binding, and a KV
namespace for the incremental cache. Set up ESLint, Prettier, Vitest, Playwright, and a
pre-commit hook. Confirm `npm run dev` and `npm run preview` (Workers runtime) both boot.
**Acceptance:** blank app renders locally in both the Next dev server and the Workers preview.

### Phase 2 — Database
Write the migrations from §3. Enable RLS on every table. Write every policy from the
permission matrix. Write a seed script with ~3 categories and ~12 realistic items with
placeholder images. Write SQL-level tests asserting each role's boundaries hold.
**Acceptance:** seeded DB, and the full role test suite from §3 passes — in particular a
`staff` JWT can flip availability and is rejected **at the database** when it touches
`price_cents`. Do not proceed to Phase 3 until every assertion in that list is green.

### Phase 3 — Public menu + i18n
Build `/[locale]/menu`, `/[locale]/menu/[category]`, `/[locale]/item/[slug]`. Availability
states per §4. Locale routing, language switcher, RTL layout, fonts, and number formatting
per §4 — all three locales working from day one. Search, filters, sticky nav, JSON-LD,
OG images. Mobile-first; test at 360px width.
**Acceptance:** Lighthouse mobile ≥ 95 performance / 100 accessibility on `/en/menu` **and**
`/fa/menu`. Zero CLS. No horizontal overflow in RTL at 360px.

### Phase 4 — Auth and admin shell
Supabase Auth magic link, `profiles` bootstrap on first sign-in, middleware route protection,
role-aware navigation, the 86 board, and the audit log writer.
**Acceptance:** each role sees exactly the right nav — a `staff` user lands on the 86 board and
sees no item editor, no price field, no settings — and the database blocks what the UI hides.

### Phase 5 — Content management + images
Item and category editors, drag-to-reorder, the full image pipeline from §6, bulk actions,
optimistic-concurrency warnings, on-demand revalidation after every write.
**Acceptance:** upload an image from a phone camera, see it live on the public menu in <10s.

### Phase 6 — QR codes
Generate QR codes with the `qrcode` npm package server-side. Per-restaurant, or per-table if
`per_table_qr` is true. Admin screen to create, label, preview, and download as SVG + PNG +
a print-ready PDF sheet of table tents. `/t/[slug]` records an anonymous scan and redirects.
Error-correction level **H**, so a code still scans with a logo knocked out of the centre and
after a bit of restaurant wear. Quiet zone of at least 4 modules. Minimum printed size 3cm.
Read §11 before generating anything printable.
**Acceptance:** printed QR scans correctly with the stock iOS and Android cameras, and the
encoded URL is built from `NEXT_PUBLIC_SITE_URL` rather than hardcoded anywhere.

### Phase 7 — Hardening, deploy, operations
- Rate-limit write endpoints and the auth endpoint.
- Security headers: CSP (no `unsafe-inline`), HSTS, `X-Content-Type-Options`, Referrer-Policy.
- Cloudflare Cron Triggers: (a) daily Supabase keep-alive ping, (b) daily 4am local
  availability-expiry reset, (c) nightly orphan-image cleanup.
- Nightly `pg_dump` of the Supabase DB to R2 via a GitHub Action, 30-day retention.
  The Supabase free tier does not include backups — this is mandatory, not optional.
- GitHub Actions: lint + typecheck + test + Playwright on PR; `wrangler deploy` on merge to `main`.
- `docs/RUNBOOK.md`: how to add an item, add a staff user, restore a backup, rotate keys,
  what to do when the site is down, and what each free-tier limit means when it is hit.
- `docs/HANDOVER.md`: written for a non-technical restaurant owner.
**Acceptance:** green CI, live URL, and I can complete the runbook's "add a new dish" steps unaided.

---

## 8. STOP-AND-ASK GATES

You cannot create accounts or spend my money. At each gate below, **stop, print exactly what
you need and the precise steps for me to get it, then wait.** Do not guess, do not fabricate
credentials, do not skip a gate by stubbing it out.

| Gate | When | What to ask me for |
|---|---|---|
| **G1** | Start of Phase 1 | GitHub repo: should you create it with `gh repo create`, or will I provide an existing remote? Private or public? |
| **G2** | Start of Phase 2 | Supabase: tell me to create a project, then ask for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the DB connection string. Remind me the service-role key is server-only. |
| **G3** | Start of Phase 1 (infra) | Cloudflare: account ID, and an API token. Tell me the **exact** token permissions needed: Workers Scripts:Edit, Workers KV Storage:Edit, Workers R2 Storage:Edit, Account Settings:Read, and — only if I use a Cloudflare-managed domain — Zone:DNS:Edit. |
| **G4** | Phase 6 | Before generating any **printable** QR artwork: confirm with me whether the custom domain is final yet. See §11 — this is the one decision that is expensive to get wrong. |
| **G5** | Phase 2 | The real menu content and images, or confirmation to ship with seed data and let me enter the real menu through the CMS. |
| **G6** | Phase 4 | My email address, to bootstrap the first `owner` account. Ask how many staff accounts and at what roles. |
| **G7** | Phase 7, before first production deploy | Explicit go-live confirmation. Show me the deploy plan and the rollback command first. |
| **G8** | Any time | Sentry, uptime monitoring, or any other third-party service — ask before adding it, and state its free-tier terms. |

**Secrets handling, always:**
- Local: `.dev.vars` and `.env.local`, both in `.gitignore`. Never commit either.
- Production: `wrangler secret put`. CI: GitHub repository secrets.
- `SUPABASE_SERVICE_ROLE_KEY` must never reach a client bundle. Add a build-time assertion
  that fails the build if any `SERVICE_ROLE` string appears in client output.
- If I paste a secret into chat, use it, but tell me to rotate it afterwards.

---

## 9. DEFINITION OF DONE

- [ ] Scanning the printed QR on a real phone opens the menu in under 2 seconds on 4G.
- [ ] Every item has an icon on the list and a hero on its own page, both replaceable by an admin.
- [ ] Three availability states render correctly, and a sold-out item is visible but clearly marked.
- [ ] Every category lists available items first, then limited, then sold out — on the menu
      page, the category page, and search results, and it re-sorts live when a dish sells out.
- [ ] A `staff` user can 86 a dish in 3 taps and cannot change a price, edit a description,
      upload an image, or publish anything — each one proven by a database-level test, not by
      the absence of a button.
- [ ] An `owner` can invite a user and assign a role without touching the database.
- [ ] Public pages leak nothing: no service-role key, no unpublished items, no `profiles` rows.
- [ ] All three locales work. `/fa/menu` renders right-to-left with no overflow at 360px, and
      an item missing a Persian translation falls back to English rather than rendering blank.
- [ ] No absolute URL is hardcoded anywhere; `NEXT_PUBLIC_SITE_URL` is the single source.
- [ ] Lighthouse mobile ≥ 95 performance, 100 accessibility, on `/en/menu` and `/fa/menu`.
- [ ] CI is green; a merge to `main` deploys automatically; rollback is one documented command.
- [ ] Nightly DB backup lands in R2 and a restore has been tested at least once.
- [ ] Monthly cost is $0 (plus domain, if any), and `docs/LIMITS.md` states what happens at each ceiling.
- [ ] `docs/RUNBOOK.md` and `docs/HANDOVER.md` exist and are written for a non-engineer.

---

## 10. WORKING AGREEMENTS

- Prefer boring, well-documented choices. No clever abstractions.
- TypeScript strict. No `any`. Zod-validate every external input.
- Small commits, conventional commit messages.
- If something cannot be done on a free tier, **say so immediately** with the cost and the
  alternatives. Do not quietly design me into a paid plan.
- If a library you reach for does not run in the Workers V8 runtime, stop and tell me rather
  than adding a Node-only shim.
- Tell me when you are uncertain. Do not present a guess as a verified fact.
- Do not install anything not listed in §2 without asking.

---

## 11. DOMAIN STRATEGY — SHIP ON workers.dev, MOVE LATER

I am deliberately launching on the free `*.workers.dev` subdomain to test and demo, then
moving to my own domain once it is proven. **A printed QR code encodes a fixed URL. If codes
are printed against the workers.dev URL and the site later moves, every printed code is dead
paper.** Build so that the move costs nothing.

**Rules for the whole build:**

1. **One source of truth for the base URL.** `NEXT_PUBLIC_SITE_URL`, injected from the
   environment. Never hardcode a hostname — not in QR generation, not in OG tags, not in
   canonical links, not in JSON-LD, not in the Supabase Auth redirect allow-list, not in the
   `sitemap.xml`, not in a test fixture. Add a CI grep that fails the build if `workers.dev`
   appears anywhere in `src/`.
2. **Use relative URLs internally.** Absolute URLs only where a spec demands them (OG, JSON-LD,
   canonical, QR payload), and always composed from the env var.
3. **During the workers.dev phase**, QR codes are for on-screen testing and a handful of
   proof-of-concept table tents only. Do not produce a bulk print run. Say this out loud to me
   if I ask for print-ready sheets before the domain is final.
4. **Keep the QR payload indirect.** Codes encode `https://{SITE_URL}/t/{slug}`, never a deep
   link to an item. The `/t/{slug}` redirect is a permanent layer of indirection, so what a
   code points at can be re-pointed in the database without reprinting.

**Migration runbook — write this into `docs/RUNBOOK.md` in Phase 7, before it is needed:**

1. Add the domain to Cloudflare, let it assign nameservers, update them at the registrar.
2. Add a Workers custom domain route for the new host.
3. Update `NEXT_PUBLIC_SITE_URL` via `wrangler secret put` / env vars and redeploy.
4. Add the new origin to the Supabase Auth redirect allow-list **before** cutting over, or
   admin magic-link logins break.
5. Update the CSP `connect-src` / `img-src` if they name hosts explicitly.
6. **Do not delete the workers.dev worker.** Leave it deployed as a permanent 301 redirect to
   the new domain, so any QR code already in the wild keeps working forever. This costs
   nothing and is the entire insurance policy.
7. Regenerate and reprint QR artwork against the new domain for all *future* printing.
8. Re-run the Playwright suite against the new origin; verify OG tags, sitemap, and JSON-LD
   all report the new host.

Flag at G4 whether I am ready for this. Until I say so, treat the workers.dev URL as
temporary in everything you build.
