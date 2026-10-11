-- Role boundary tests (spec §3 acceptance). Each role authenticates with a JWT-equivalent
-- claim and every boundary is asserted AT THE DATABASE, not via UI absence.
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

-- ---------------------------------------------------------------- fixtures (as postgres)
-- R1 = seeded Demo Bistro (published). R2 = another restaurant (unpublished).
insert into public.restaurants (id, name, slug, is_published)
values ('22222222-0000-4000-8000-000000000001', 'Hidden Place', 'hidden-place', false);
insert into public.categories (id, restaurant_id, name, slug)
values ('22222222-0000-4000-8000-0000000000c1', '22222222-0000-4000-8000-000000000001', 'Secret', 'secret');
insert into public.items (id, restaurant_id, category_id, name, slug, price_cents)
values ('22222222-0000-4000-8000-0000000000d1', '22222222-0000-4000-8000-000000000001',
        '22222222-0000-4000-8000-0000000000c1', 'Other Dish', 'other-dish', 500);

-- Unpublished item and unpublished category in R1.
insert into public.categories (id, restaurant_id, name, slug, is_published)
values ('11111111-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-000000000001', 'Seasonal', 'seasonal', false);
insert into public.items (id, restaurant_id, category_id, name, slug, price_cents, is_published) values
  ('11111111-0000-4000-8000-0000000000d8', '00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-0000000000c1', 'Draft Dish', 'draft-dish', 999, false),
  ('11111111-0000-4000-8000-0000000000d9', '00000000-0000-4000-8000-000000000001',
   '11111111-0000-4000-8000-0000000000c9', 'Winter Dish', 'winter-dish', 999, true);

insert into auth.users (id, email, aud, role) values
  ('11111111-0000-4000-8000-0000000000a1', 't-owner@test.local', 'authenticated', 'authenticated'),
  ('11111111-0000-4000-8000-0000000000a2', 't-admin@test.local', 'authenticated', 'authenticated'),
  ('11111111-0000-4000-8000-0000000000a3', 't-staff@test.local', 'authenticated', 'authenticated'),
  ('11111111-0000-4000-8000-0000000000a4', 't-gone@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id, restaurant_id, email, role, is_active) values
  ('11111111-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 't-owner@test.local', 'owner', true),
  ('11111111-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001', 't-admin@test.local', 'admin', true),
  ('11111111-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-000000000001', 't-staff@test.local', 'staff', true),
  ('11111111-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-000000000001', 't-gone@test.local', 'admin', false);

-- Item under test: Koobideh Kebab, price 2400.
-- ================================================================= STAFF
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-0000-4000-8000-0000000000a3","role":"authenticated"}';

select lives_ok(
  $$ select public.set_item_availability('00000000-0000-4000-8000-0000000000e1', 'unavailable', '86 at 8pm') $$,
  'staff CAN flip availability and set a note');
select results_eq(
  $$ select availability::text, availability_note from public.items where id = '00000000-0000-4000-8000-0000000000e1' $$,
  $$ values ('unavailable', '86 at 8pm') $$,
  'staff availability change persisted');
select lives_ok(
  $$ select public.set_item_availability('00000000-0000-4000-8000-0000000000e1', 'limited', null, 3,
                                         now() + interval '2 hours') $$,
  'staff CAN set remaining qty and until');

update public.items set price_cents = 1 where id = '00000000-0000-4000-8000-0000000000e1';
select is((select price_cents from public.items where id = '00000000-0000-4000-8000-0000000000e1'), 2400,
  'staff UPDATE of price_cents changes nothing (no RLS update policy)');
update public.items set availability = 'available' where id = '00000000-0000-4000-8000-0000000000e1';
select is((select availability::text from public.items where id = '00000000-0000-4000-8000-0000000000e1'), 'limited',
  'staff cannot bypass the RPC with a direct table UPDATE');

select throws_ok(
  $$ insert into public.items (restaurant_id, category_id, name, slug, price_cents)
     values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000c1', 'x', 'x', 1) $$,
  '42501', null, 'staff cannot INSERT items');
delete from public.items where id = '00000000-0000-4000-8000-0000000000d3';
select throws_ok(
  $$ insert into public.categories (restaurant_id, name, slug)
     values ('00000000-0000-4000-8000-000000000001', 'x', 'x') $$,
  '42501', null, 'staff cannot INSERT categories');
delete from public.categories where id = '00000000-0000-4000-8000-0000000000c3';
select throws_ok(
  $$ insert into public.item_translations (item_id, locale, name)
     values ('00000000-0000-4000-8000-0000000000d4', 'fr', 'Soupe') $$,
  '42501', null, 'staff cannot INSERT item_translations');
delete from public.item_translations where item_id = '00000000-0000-4000-8000-0000000000d1';
update public.restaurants set banner_message = 'hacked' where id = '00000000-0000-4000-8000-000000000001';
select throws_ok(
  $$ insert into public.item_variants (item_id, name) values ('00000000-0000-4000-8000-0000000000e1', 'x') $$,
  '42501', null, 'staff cannot add variants');
select throws_ok(
  $$ select public.set_item_availability('22222222-0000-4000-8000-0000000000d1', 'unavailable') $$,
  'P0002', null, 'staff cannot touch another restaurant''s items');
select throws_ok(
  $$ select public.reset_all_availability('00000000-0000-4000-8000-000000000001') $$,
  '42501', null, 'staff cannot reset all availability');
select is((select count(*)::int from public.audit_log), 0, 'staff cannot read the audit log');
select is((select count(*)::int from public.profiles), 1, 'staff sees only their own profile');
select throws_ok(
  $$ select public.expire_availability() $$, '42501', null, 'staff cannot run the expiry job');

-- Trigger layer: even a role that bypasses RLS is stopped when the JWT belongs to staff.
reset role;
select throws_ok(
  $$ update public.items set price_cents = 1 where id = '00000000-0000-4000-8000-0000000000e1' $$,
  '42501', null, 'BEFORE UPDATE trigger rejects staff price change even if RLS is bypassed');
select throws_ok(
  $$ update public.items set name = 'x', availability = 'available' where id = '00000000-0000-4000-8000-0000000000e1' $$,
  '42501', null, 'trigger rejects mixed availability + description change by staff');

-- Verify (as postgres, no RLS) that nothing staff attempted leaked through.
set local request.jwt.claims to '';
select is((select count(*)::int from public.items where id = '00000000-0000-4000-8000-0000000000d3'), 1,
  'staff DELETE on items removed nothing');
select is((select count(*)::int from public.categories where id = '00000000-0000-4000-8000-0000000000c3'), 1,
  'staff DELETE on categories removed nothing');
select is((select count(*)::int from public.item_translations where item_id = '00000000-0000-4000-8000-0000000000d1'), 2,
  'staff DELETE on item_translations removed nothing');
select is((select banner_message from public.restaurants where id = '00000000-0000-4000-8000-000000000001'), null,
  'staff cannot change restaurant settings');
select ok(exists (select 1 from public.audit_log where action = 'availability' and entity = 'items'
                  and actor_id = '11111111-0000-4000-8000-0000000000a3'),
  'staff availability change is in the audit log with the staff member as actor');

-- ================================================================= ADMIN
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-0000-4000-8000-0000000000a2","role":"authenticated"}';

update public.items set price_cents = 2600 where id = '00000000-0000-4000-8000-0000000000e1';
select is((select price_cents from public.items where id = '00000000-0000-4000-8000-0000000000e1'), 2600,
  'admin CAN change prices');
select lives_ok(
  $$ insert into public.categories (restaurant_id, name, slug)
     values ('00000000-0000-4000-8000-000000000001', 'Drinks', 'drinks') $$,
  'admin CAN create categories');
update public.restaurants set banner_message = 'admin was here' where id = '00000000-0000-4000-8000-000000000001';
update public.profiles set role = 'owner' where id = '11111111-0000-4000-8000-0000000000a3';
select is((select count(*)::int from public.audit_log), 0, 'admin cannot read the audit log');
select lives_ok($$ select public.reset_all_availability('00000000-0000-4000-8000-000000000001') $$,
  'admin CAN reset all availability');

-- Deactivated admin has no powers.
set local request.jwt.claims to '{"sub":"11111111-0000-4000-8000-0000000000a4","role":"authenticated"}';
update public.items set price_cents = 1 where id = '00000000-0000-4000-8000-0000000000e2';

reset role;
set local request.jwt.claims to '';
select is((select banner_message from public.restaurants where id = '00000000-0000-4000-8000-000000000001'), null,
  'admin cannot write restaurant settings');
select is((select role::text from public.profiles where id = '11111111-0000-4000-8000-0000000000a3'), 'staff',
  'admin cannot change profiles');
select is((select price_cents from public.items where id = '00000000-0000-4000-8000-0000000000e2'), 2300,
  'a deactivated user cannot edit anything');

-- ================================================================= OWNER
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-0000-4000-8000-0000000000a1","role":"authenticated"}';

update public.restaurants set banner_message = 'Closed Monday' where id = '00000000-0000-4000-8000-000000000001';
select is((select banner_message from public.restaurants where id = '00000000-0000-4000-8000-000000000001'),
  'Closed Monday', 'owner CAN change restaurant settings');
update public.profiles set role = 'admin' where id = '11111111-0000-4000-8000-0000000000a3';
select is((select role::text from public.profiles where id = '11111111-0000-4000-8000-0000000000a3'), 'admin',
  'owner CAN change a team member''s role');
select throws_ok(
  $$ update public.profiles set role = 'staff' where id = '11111111-0000-4000-8000-0000000000a1' $$,
  '42501', null, 'owner cannot demote themselves (lock-out guard)');
select ok((select count(*) from public.audit_log) > 0, 'owner CAN read the audit log');

-- ================================================================= ANON (diners)
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select * from public.audit_log $$, '42501', null, 'anon cannot read the audit log');
select throws_ok($$ select * from public.scan_events $$, '42501', null, 'anon cannot read scan events');
select throws_ok($$ select updated_by from public.items $$, '42501', null, 'anon cannot read items.updated_by');
select is((select count(*)::int from public.items where slug in ('draft-dish', 'winter-dish', 'other-dish')), 0,
  'anon cannot read unpublished items, items in unpublished categories, or unpublished restaurants');
select is((select count(*)::int from public.restaurants where slug = 'hidden-place'), 0,
  'anon cannot read unpublished restaurants');
select throws_ok(
  $$ update public.items set price_cents = 1 where id = '00000000-0000-4000-8000-0000000000e1' $$,
  '42501', null, 'anon cannot write items');
select ok(public.menu_json('demo-bistro', 'en')::text not like '%Draft Dish%'
          and public.menu_json('demo-bistro', 'en')::text not like '%Winter Dish%',
  'menu_json never includes unpublished content');
select is(public.record_scan('main', 'Safari', false), '/', 'anon CAN record a QR scan');

select * from finish();
rollback;
