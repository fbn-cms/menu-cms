-- Chef's pick on the 86 board (staff may toggle it, nothing more) + translated option names.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, aud, role) values
  ('55555555-0000-4000-8000-0000000000a2', 'p-admin@test.local', 'authenticated', 'authenticated'),
  ('55555555-0000-4000-8000-0000000000a3', 'p-staff@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id, restaurant_id, role) values
  ('55555555-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001', 'admin'),
  ('55555555-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-000000000001', 'staff');

-- ============================================================ STAFF
set local role authenticated;
set local request.jwt.claims to '{"sub":"55555555-0000-4000-8000-0000000000a3","role":"authenticated"}';
select lives_ok($$ select public.set_item_featured('00000000-0000-4000-8000-0000000000e2', true) $$,
  'staff CAN mark a dish as Chef''s pick from the 86 board');
reset role;
select is((select is_featured from public.items where id = '00000000-0000-4000-8000-0000000000e2'), true, 'Chef''s pick saved');
select ok(exists (select 1 from public.audit_log where action = 'feature' and actor_id = '55555555-0000-4000-8000-0000000000a3'),
  'the audit log records who toggled Chef''s pick');
-- Trigger layer, bypassing RLS with a staff JWT: is_featured passes, anything else is still refused.
select lives_ok($$ update public.items set is_featured = false where id = '00000000-0000-4000-8000-0000000000e2' $$,
  'trigger lets staff change is_featured');
select throws_ok($$ update public.items set is_featured = true, price_cents = 1 where id = '00000000-0000-4000-8000-0000000000e2' $$,
  '42501', null, 'trigger still refuses staff price changes alongside is_featured');
select throws_ok($$ update public.items set name = 'x' where id = '00000000-0000-4000-8000-0000000000e2' $$,
  '42501', null, 'trigger still refuses staff name changes');

-- ============================================================ ADMIN editor keeps Chef's pick
set local request.jwt.claims to '';
update public.items set is_featured = true where id = '00000000-0000-4000-8000-0000000000e1';
set local role authenticated;
set local request.jwt.claims to '{"sub":"55555555-0000-4000-8000-0000000000a2","role":"authenticated"}';
select lives_ok($$
  select public.save_item('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000001',
    '{"category_id":"00000000-0000-4000-8000-0000000000c2","name":"Koobideh Kebab","slug":"koobideh-kebab","price_cents":2400,"is_published":true}',
    '{}', '{}',
    '[{"name":"Family tray","price_delta_cents":3600,"sort_order":1,"translations":{"fa":"سینی خانوادگی","fr":""}}]')
$$, 'admin saves the dish (editor sends no is_featured) with a translated option');
reset role;
select is((select is_featured from public.items where id = '00000000-0000-4000-8000-0000000000e1'), true,
  'saving in the editor does not undo the chef''s choice');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is(public.item_json('demo-bistro', 'koobideh-kebab', 'fa') -> 'variants' -> 0 ->> 'name', 'سینی خانوادگی',
  'translated option name is shown in Persian');
select is(public.item_json('demo-bistro', 'koobideh-kebab', 'fr') -> 'variants' -> 0 ->> 'name', 'Family tray',
  'missing French option name falls back to English');

select * from finish();
rollback;
