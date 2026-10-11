-- Core schema. Every table has RLS enabled (see 20261011000003_rls.sql); nothing is reachable
-- without an explicit policy. Base-table text columns hold English; *_translations override.

create schema if not exists private;
revoke all on schema private from public;

create type public.app_role as enum ('owner', 'admin', 'staff');
create type public.availability_state as enum ('available', 'limited', 'unavailable');
create type public.tag_kind as enum ('dietary', 'feature', 'allergen');

-- Locales that can have translation rows. 'en' is the base language stored on the base tables.
create domain public.translation_locale as text check (value in ('fa', 'fr'));
create domain public.slug as text check (value ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(value) <= 80);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  slug public.slug not null unique,
  logo_key text,
  currency char(3) not null default 'CAD',
  timezone text not null default 'America/Toronto',
  locale text not null default 'en-CA',
  default_locale text not null default 'en' check (default_locale in ('en', 'fa', 'fr')),
  -- Persian digit style: 'latn' = 123 (default), 'arabext' = ۱۲۳
  persian_digits text not null default 'latn' check (persian_digits in ('latn', 'arabext')),
  theme_json jsonb not null default '{}',
  address text,
  phone text,
  hours_json jsonb not null default '{}',
  banner_message text check (length(banner_message) <= 280),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  slug public.slug not null,
  description text check (length(description) <= 500),
  icon_key text,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, slug),
  unique (id, restaurant_id) -- target for the composite FK on items
);
create index on public.categories (restaurant_id, sort_order);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  email text,
  full_name text check (length(full_name) <= 120),
  role public.app_role not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.profiles (restaurant_id);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid not null,
  name text not null check (length(name) between 1 and 120),
  slug public.slug not null,
  short_description text check (length(short_description) <= 200),
  long_description text check (length(long_description) <= 4000),
  price_cents integer not null check (price_cents >= 0),
  currency char(3) not null default 'CAD',
  icon_key text,
  hero_key text,
  icon_lqip text check (length(icon_lqip) <= 4000),
  hero_lqip text check (length(hero_lqip) <= 4000),
  availability public.availability_state not null default 'available',
  remaining_qty integer check (remaining_qty >= 0),
  availability_note text check (length(availability_note) <= 140),
  availability_until timestamptz,
  prep_minutes integer check (prep_minutes between 0 and 600),
  calories integer check (calories between 0 and 10000),
  spice_level smallint not null default 0 check (spice_level between 0 and 3),
  is_featured boolean not null default false,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, slug),
  -- An item's category must belong to the same restaurant.
  foreign key (category_id, restaurant_id) references public.categories (id, restaurant_id) on delete restrict
);
create index on public.items (category_id, availability, sort_order);
create index on public.items (restaurant_id);

create table public.item_variants (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  price_delta_cents integer not null default 0,
  availability public.availability_state not null default 'available',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.item_variants (item_id, sort_order);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  label text not null check (length(label) between 1 and 40),
  kind public.tag_kind not null,
  icon text check (length(icon) <= 40),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, kind, label)
);

create table public.item_tags (
  item_id uuid not null references public.items (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, tag_id)
);
create index on public.item_tags (tag_id);

create table public.item_translations (
  item_id uuid not null references public.items (id) on delete cascade,
  locale public.translation_locale not null,
  name text check (length(name) <= 120),
  short_description text check (length(short_description) <= 200),
  long_description text check (length(long_description) <= 4000),
  availability_note text check (length(availability_note) <= 140),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, locale)
);

create table public.category_translations (
  category_id uuid not null references public.categories (id) on delete cascade,
  locale public.translation_locale not null,
  name text check (length(name) <= 80),
  description text check (length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (category_id, locale)
);

create table public.tag_translations (
  tag_id uuid not null references public.tags (id) on delete cascade,
  locale public.translation_locale not null,
  label text check (length(label) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tag_id, locale)
);

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  label text not null check (length(label) between 1 and 80),
  table_number integer check (table_number > 0),
  -- Relative path only; the host always comes from NEXT_PUBLIC_SITE_URL.
  target_path text not null default '/' check (target_path ~ '^/[^/]' or target_path = '/'),
  slug public.slug not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only logs: occurred_at instead of created_at/updated_at.
create table public.scan_events (
  id bigint generated always as identity primary key,
  qr_code_id uuid not null references public.qr_codes (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  ua_family text check (length(ua_family) <= 40),
  is_bot boolean not null default false
);
create index on public.scan_events (qr_code_id, occurred_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  before_json jsonb,
  after_json jsonb,
  occurred_at timestamptz not null default now()
);
create index on public.audit_log (restaurant_id, occurred_at desc);

-- R2 keys to delete in the nightly cleanup job. Never delete inside a user request.
create table public.image_deletions (
  key text primary key,
  enqueued_at timestamptz not null default now()
);

alter table public.restaurants enable row level security;
alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.item_variants enable row level security;
alter table public.tags enable row level security;
alter table public.item_tags enable row level security;
alter table public.item_translations enable row level security;
alter table public.category_translations enable row level security;
alter table public.tag_translations enable row level security;
alter table public.qr_codes enable row level security;
alter table public.scan_events enable row level security;
alter table public.audit_log enable row level security;
alter table public.image_deletions enable row level security;
