-- External AI providers (owner request 2026-10-14): the owner can store an Anthropic (Claude)
-- and/or OpenAI (ChatGPT) API key and choose which provider writes/translates dish text.
--
-- Security:
--  * Keys are stored ENCRYPTED (AES-256-GCM) by the server with AI_KEYS_SECRET, a Worker
--    secret that never touches the database. A database leak alone does not reveal keys.
--  * RLS on, NO policies, privileges revoked: no signed-in user (not even the owner) can read
--    this table through the Data API. Only server code with the secret key touches it, after
--    checking the caller's role.
--  * Deliberately NOT attached to the generic audit trigger (it would copy ciphertext into
--    audit_log). The server writes explicit audit rows ("added Claude key ••••abcd").

create table public.ai_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  provider text not null default 'cloudflare' check (provider in ('cloudflare', 'anthropic', 'openai')),
  anthropic_key_enc text,
  anthropic_key_hint text check (length(anthropic_key_hint) <= 8),
  anthropic_model text not null default 'claude-opus-5-5',
  openai_key_enc text,
  openai_key_hint text check (length(openai_key_hint) <= 8),
  openai_model text not null default 'gpt-6.1-sol',
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A provider can only be selected while its key exists.
  constraint provider_has_key check (
    provider = 'cloudflare'
    or (provider = 'anthropic' and anthropic_key_enc is not null)
    or (provider = 'openai' and openai_key_enc is not null)
  )
);
alter table public.ai_settings enable row level security;
revoke all on public.ai_settings from anon, authenticated;
create trigger set_updated_at before update on public.ai_settings
  for each row execute function private.set_updated_at();
