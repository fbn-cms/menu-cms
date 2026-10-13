-- AI keys are unreachable through the Data API for every role, including the owner.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into public.ai_settings (restaurant_id, provider, anthropic_key_enc, anthropic_key_hint)
values ('00000000-0000-4000-8000-000000000001', 'anthropic', 'v1:ciphertext', 'abcd');

insert into auth.users (id, email, aud, role) values
  ('66666666-0000-4000-8000-0000000000a1', 'k-owner@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id, restaurant_id, role) values
  ('66666666-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'owner');

set local role authenticated;
set local request.jwt.claims to '{"sub":"66666666-0000-4000-8000-0000000000a1","role":"authenticated"}';
select throws_ok($$ select * from public.ai_settings $$, '42501', null, 'even the owner cannot read stored AI keys via the API');
select throws_ok($$ update public.ai_settings set provider = 'cloudflare' $$, '42501', null, 'nor change them via the API');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select * from public.ai_settings $$, '42501', null, 'diners cannot read AI keys');

reset role;
select throws_ok($$ update public.ai_settings set anthropic_key_enc = null $$, '23514', null,
  'the selected provider must keep its key (switch provider first)');

select * from finish();
rollback;
