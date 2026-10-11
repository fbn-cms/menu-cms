-- Ordering rule (available → limited → unavailable, then sort_order, then name), locale
-- fallback, and availability expiry — all through menu_json, the single list read path.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create function pg_temp.slugs(p_category text, p_locale text default 'en') returns text[]
language sql as $$
  select array_agg(i ->> 'slug' order by ord)
  from jsonb_array_elements(public.menu_json('demo-bistro', p_locale) -> 'categories') c,
       jsonb_array_elements(c -> 'items') with ordinality as x(i, ord)
  where c ->> 'slug' = p_category
$$;

create function pg_temp.item(p_slug text, p_locale text) returns jsonb
language sql as $$
  select i from jsonb_array_elements(public.menu_json('demo-bistro', p_locale) -> 'categories') c,
                jsonb_array_elements(c -> 'items') i
  where i ->> 'slug' = p_slug
$$;

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

-- Seed: Starters = Kashk (available, 1), Mirza (limited, 2), Shirazi (available, 3), Soup (unavailable, 0)
select is(pg_temp.slugs('starters'),
  array['kashk-e-bademjan', 'shirazi-salad', 'mirza-ghasemi', 'soup-of-the-day'],
  'availability sorts before sort_order: sold-out Soup (sort 0) sinks to the bottom');
select is(pg_temp.slugs('mains'),
  array['koobideh-kebab', 'joojeh-kebab', 'ghormeh-sabzi', 'vegetable-tahdig-bowl', 'fesenjan'],
  'mains: available, then limited, then sold out');
select is(
  (select array_agg(c ->> 'slug') from jsonb_array_elements(public.menu_json('demo-bistro', 'en') -> 'categories') c),
  array['starters', 'mains', 'desserts'],
  'sold-out items stay in their own category (no global sold-out section)');

-- A dish sells out → it moves to the bottom of its category, behind the older sold-out item
-- only by sort_order.
reset role;
update public.items set availability = 'unavailable' where slug = 'kashk-e-bademjan';
set local role anon;
select is(pg_temp.slugs('starters'),
  array['shirazi-salad', 'mirza-ghasemi', 'soup-of-the-day', 'kashk-e-bademjan'],
  'flipping an item to sold out re-sorts it below available and limited items');

-- Tie on availability and sort_order → name decides.
reset role;
update public.items set sort_order = 5 where slug in ('saffron-ice-cream', 'faloodeh', 'saffron-creme-brulee');
set local role anon;
select is(pg_temp.slugs('desserts'),
  array['faloodeh', 'saffron-creme-brulee', 'saffron-ice-cream'],
  'equal availability and sort_order fall back to name');

-- Locale fallback: never blank.
select is(pg_temp.item('mirza-ghasemi', 'fa') ->> 'name', 'میرزا قاسمی', 'fa translation is used when present');
select is(pg_temp.item('mirza-ghasemi', 'fr') ->> 'name', 'Mirza Ghasemi', 'missing fr name falls back to English');
select is(pg_temp.item('soup-of-the-day', 'fa') ->> 'short_description', 'Ask your server for today''s soup.',
  'missing fa description falls back to English');
select is(
  (select count(*)::int
   from jsonb_array_elements(public.menu_json('demo-bistro', 'fa') -> 'categories') c,
        jsonb_array_elements(c -> 'items') i
   where coalesce(i ->> 'name', '') = ''),
  0, 'no item renders with an empty name in fa');
select is(pg_temp.item('mirza-ghasemi', 'en') ->> 'remaining_qty', '4', 'limited item exposes remaining qty');

-- Expiry: an override whose "until" passed shows as available immediately…
reset role;
update public.items set availability = 'unavailable', availability_until = now() - interval '1 minute'
where slug = 'shirazi-salad';
set local role anon;
select is(pg_temp.item('shirazi-salad', 'en') ->> 'availability', 'available',
  'expired override is shown as available even before the cron runs');

-- …and the cron job clears it in the table.
reset role;
select ok('00000000-0000-4000-8000-000000000001'::uuid in (select public.expire_availability()),
  'expire_availability reports the affected restaurant');
select is((select availability::text from public.items where slug = 'shirazi-salad'), 'available',
  'expire_availability resets the row');

select * from finish();
rollback;
