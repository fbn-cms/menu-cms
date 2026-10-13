-- Phase 5 content-management RPCs: admins can save atomically; staff/anon are refused by RLS.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, aud, role) values
  ('33333333-0000-4000-8000-0000000000a2', 'c-admin@test.local', 'authenticated', 'authenticated'),
  ('33333333-0000-4000-8000-0000000000a3', 'c-staff@test.local', 'authenticated', 'authenticated');
insert into public.profiles (id, restaurant_id, role) values
  ('33333333-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001', 'admin'),
  ('33333333-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-000000000001', 'staff');

-- ============================================================ ADMIN
set local role authenticated;
set local request.jwt.claims to '{"sub":"33333333-0000-4000-8000-0000000000a2","role":"authenticated"}';

select lives_ok($$
  select public.save_item(
    '44444444-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000001',
    '{"category_id":"00000000-0000-4000-8000-0000000000c2","name":"Barg Kebab","slug":"barg-kebab",
      "short_description":"Saffron lamb fillet","price_cents":3100,"spice_level":0,"is_published":true}',
    '{"fa":{"name":"کباب برگ"},"fr":{"name":""}}',
    array['00000000-0000-4000-8000-0000000000a3','00000000-0000-4000-8000-0000000000a5']::uuid[],
    '[{"name":"Regular","price_delta_cents":0,"sort_order":1},{"name":"Large","price_delta_cents":800,"sort_order":2}]')
$$, 'admin creates a dish with translation, tags and variants in one call');

reset role;
select is((select count(*)::int from public.item_translations where item_id = '44444444-0000-4000-8000-0000000000d1'), 1,
  'empty translations are not stored (only fa)');
select is((select count(*)::int from public.item_tags where item_id = '44444444-0000-4000-8000-0000000000d1'), 2, 'tags saved');
select is((select count(*)::int from public.item_variants where item_id = '44444444-0000-4000-8000-0000000000d1'), 2, 'variants saved');
select is((select sort_order from public.items where id = '44444444-0000-4000-8000-0000000000d1'), 6,
  'a new dish goes to the end of its category');
set local role authenticated;

-- Edit: drop a tag, remove a variant, clear the fa translation.
select lives_ok($$
  select public.save_item(
    '44444444-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000001',
    '{"category_id":"00000000-0000-4000-8000-0000000000c2","name":"Barg Kebab","slug":"barg-kebab","price_cents":3200,"is_published":true}',
    '{"fa":{"name":""}}', array['00000000-0000-4000-8000-0000000000a3']::uuid[], '[]',
    (select updated_at from public.items where id = '44444444-0000-4000-8000-0000000000d1'))
$$, 'admin edits the dish with the current version');
reset role;
select results_eq(
  $$ select price_cents, (select count(*)::int from public.item_tags where item_id = i.id),
            (select count(*)::int from public.item_variants where item_id = i.id),
            (select count(*)::int from public.item_translations where item_id = i.id)
     from public.items i where id = '44444444-0000-4000-8000-0000000000d1' $$,
  $$ values (3200, 1, 0, 0) $$,
  'edit replaced price, tags, variants and translations exactly');
set local role authenticated;

select throws_ok($$
  select public.save_item('44444444-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000001',
    '{"category_id":"00000000-0000-4000-8000-0000000000c2","name":"X","slug":"barg-kebab","price_cents":1}',
    '{}', '{}', '[]', '2000-01-01T00:00:00Z')
$$, '40001', null, 'a stale save is refused, not silently overwritten');

select lives_ok($$
  select public.save_category('44444444-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-000000000001',
    '{"name":"Drinks","slug":"drinks"}', '{"fa":{"name":"نوشیدنی"},"fr":{"name":"Boissons"}}')
$$, 'admin creates a category with translations');
select lives_ok($$
  select public.save_tag('44444444-0000-4000-8000-0000000000b9', '00000000-0000-4000-8000-000000000001',
    '{"label":"Spicy","kind":"feature","icon":"flame"}', '{"fa":"تند","fr":"Épicé"}')
$$, 'admin creates a tag with translations');

select is(public.reorder_categories(array['00000000-0000-4000-8000-0000000000c3','00000000-0000-4000-8000-0000000000c1',
  '00000000-0000-4000-8000-0000000000c2','44444444-0000-4000-8000-0000000000c9']::uuid[]), 3,
  'reorder updates only the rows whose position changed');
select is(public.set_items_published(array['44444444-0000-4000-8000-0000000000d1']::uuid[], false), 1, 'bulk unpublish');

-- ============================================================ STAFF
set local request.jwt.claims to '{"sub":"33333333-0000-4000-8000-0000000000a3","role":"authenticated"}';
select throws_ok($$
  select public.save_item('44444444-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-000000000001',
    '{"category_id":"00000000-0000-4000-8000-0000000000c2","name":"Hacked","slug":"barg-kebab","price_cents":1}',
    '{}', '{}', '[]')
$$, '42501', null, 'staff cannot edit a dish through save_item');
select throws_ok($$
  select public.save_item('44444444-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-000000000001',
    '{"category_id":"00000000-0000-4000-8000-0000000000c2","name":"New","slug":"new-dish","price_cents":1}',
    '{}', '{}', '[]')
$$, '42501', null, 'staff cannot create a dish');
select is(public.set_items_published(array['00000000-0000-4000-8000-0000000000d1']::uuid[], false), 0,
  'staff bulk unpublish changes nothing');
select is(public.reorder_categories(array['00000000-0000-4000-8000-0000000000c1']::uuid[]), 0,
  'staff reorder changes nothing');

select * from finish();
rollback;
