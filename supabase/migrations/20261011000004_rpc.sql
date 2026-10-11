-- RPCs used by the app. Public read RPCs are SECURITY INVOKER (RLS applies) and additionally
-- filter on is_published so a signed-in staff member previewing the menu sees what diners see.

---------------------------------------------------------------------------------------------
-- Diner reads
---------------------------------------------------------------------------------------------

-- Whole menu for one restaurant in one locale, already ordered per the spec §3 ordering rule.
-- This is the ONLY read path for menu lists (menu page, category page, client-side search).
-- Missing translations fall back to English and are never returned blank.
create function public.menu_json(p_restaurant_slug text, p_locale text default 'en')
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with r as (
    select * from public.restaurants where slug = p_restaurant_slug and is_published
  ),
  tag_list as (
    select t.id, t.kind, t.icon, t.sort_order,
           coalesce(nullif(tt.label, ''), t.label) as label
    from public.tags t
    join r on r.id = t.restaurant_id
    left join public.tag_translations tt on tt.tag_id = t.id and tt.locale = p_locale
  ),
  item_list as (
    select i.id, i.slug, i.category_id, i.name, i.price_cents, i.currency, i.icon_key, i.icon_lqip,
           i.spice_level, i.is_featured, i.sort_order,
           public.effective_availability(i.availability, i.availability_until) as eff,
           coalesce(nullif(it.name, ''), i.name) as l_name,
           coalesce(nullif(it.short_description, ''), i.short_description) as l_short,
           coalesce(nullif(it.availability_note, ''), i.availability_note) as l_note,
           i.remaining_qty as l_qty
    from public.items i
    join r on r.id = i.restaurant_id
    left join public.item_translations it on it.item_id = i.id and it.locale = p_locale
    where i.is_published
  )
  select jsonb_build_object(
    'restaurant', (
      select jsonb_build_object(
        'id', r.id, 'name', r.name, 'slug', r.slug, 'logo_key', r.logo_key,
        'currency', r.currency, 'timezone', r.timezone, 'persian_digits', r.persian_digits,
        'address', r.address, 'phone', r.phone, 'hours', r.hours_json,
        'banner_message', r.banner_message, 'theme', r.theme_json)
      from r),
    'locale', p_locale,
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'icon', icon, 'label', label)
                       order by kind, sort_order, label)
      from tag_list), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'slug', c.slug,
               'name', coalesce(nullif(ct.name, ''), c.name),
               'description', coalesce(nullif(ct.description, ''), c.description),
               'icon_key', c.icon_key,
               'items', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', i.id, 'slug', i.slug, 'category_id', i.category_id,
                          'name', i.l_name, 'short_description', i.l_short,
                          'price_cents', i.price_cents, 'currency', i.currency,
                          'icon_key', i.icon_key, 'icon_lqip', i.icon_lqip,
                          'availability', i.eff,
                          'availability_note', case when i.eff = 'available' then null else i.l_note end,
                          'remaining_qty', case when i.eff = 'limited' then i.l_qty end,
                          'spice_level', i.spice_level, 'is_featured', i.is_featured,
                          'sort_order', i.sort_order,
                          'tag_ids', coalesce((select jsonb_agg(x.tag_id) from public.item_tags x
                                               where x.item_id = i.id), '[]'::jsonb))
                        order by public.availability_rank(i.eff), i.sort_order, i.l_name)
                 from item_list i where i.category_id = c.id), '[]'::jsonb))
             order by c.sort_order, c.name)
      from public.categories c
      join r on r.id = c.restaurant_id
      left join public.category_translations ct on ct.category_id = c.id and ct.locale = p_locale
      where c.is_published), '[]'::jsonb)
  )
  where exists (select 1 from r)
$$;

-- One item for the detail page. Slugs are locale-independent.
create function public.item_json(p_restaurant_slug text, p_item_slug text, p_locale text default 'en')
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'id', i.id, 'slug', i.slug,
    'name', coalesce(nullif(it.name, ''), i.name),
    'short_description', coalesce(nullif(it.short_description, ''), i.short_description),
    'long_description', coalesce(nullif(it.long_description, ''), i.long_description),
    'price_cents', i.price_cents, 'currency', i.currency,
    'icon_key', i.icon_key, 'hero_key', i.hero_key, 'hero_lqip', i.hero_lqip,
    'availability', public.effective_availability(i.availability, i.availability_until),
    'availability_note', case when public.effective_availability(i.availability, i.availability_until) = 'available'
                              then null else coalesce(nullif(it.availability_note, ''), i.availability_note) end,
    'remaining_qty', case when public.effective_availability(i.availability, i.availability_until) = 'limited'
                          then i.remaining_qty end,
    'prep_minutes', i.prep_minutes, 'calories', i.calories, 'spice_level', i.spice_level,
    'is_featured', i.is_featured, 'updated_at', i.updated_at,
    'category', jsonb_build_object('id', c.id, 'slug', c.slug,
                                   'name', coalesce(nullif(ct.name, ''), c.name)),
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name,
                                          'price_cents', i.price_cents + v.price_delta_cents,
                                          'availability', v.availability)
                       order by public.availability_rank(v.availability), v.sort_order, v.name)
      from public.item_variants v where v.item_id = i.id), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'kind', t.kind, 'icon', t.icon,
                                          'label', coalesce(nullif(tt.label, ''), t.label))
                       order by t.kind, t.sort_order, t.label)
      from public.item_tags x
      join public.tags t on t.id = x.tag_id
      left join public.tag_translations tt on tt.tag_id = t.id and tt.locale = p_locale
      where x.item_id = i.id), '[]'::jsonb)
  )
  from public.items i
  join public.restaurants r on r.id = i.restaurant_id
  join public.categories c on c.id = i.category_id
  left join public.item_translations it on it.item_id = i.id and it.locale = p_locale
  left join public.category_translations ct on ct.category_id = c.id and ct.locale = p_locale
  where r.slug = p_restaurant_slug and i.slug = p_item_slug
    and r.is_published and c.is_published and i.is_published
$$;

---------------------------------------------------------------------------------------------
-- 86 board
---------------------------------------------------------------------------------------------

-- The one write staff can make. Setting 'available' clears note/qty/until.
-- p_expected_updated_at enables optimistic concurrency: a stale write is rejected (40001).
create function public.set_item_availability(
  p_item_id uuid,
  p_availability public.availability_state,
  p_note text default null,
  p_remaining_qty integer default null,
  p_until timestamptz default null,
  p_expected_updated_at timestamptz default null
)
returns table (id uuid, availability public.availability_state, availability_note text,
               remaining_qty integer, availability_until timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.items%rowtype;
begin
  select * into v_item from public.items i where i.id = p_item_id for update;
  if not found or not private.has_role(v_item.restaurant_id, 'owner', 'admin', 'staff') then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
  if p_expected_updated_at is not null and v_item.updated_at <> p_expected_updated_at then
    raise exception 'item was changed by someone else' using errcode = '40001';
  end if;
  if p_until is not null and p_until <= now() then
    raise exception 'until must be in the future' using errcode = '22023';
  end if;

  return query
  update public.items i set
    availability = p_availability,
    availability_note = case when p_availability = 'available' then null else nullif(trim(p_note), '') end,
    remaining_qty = case when p_availability = 'limited' then p_remaining_qty end,
    availability_until = case when p_availability = 'available' then null else p_until end
  where i.id = p_item_id
  returning i.id, i.availability, i.availability_note, i.remaining_qty, i.availability_until, i.updated_at;
end
$$;

-- "Reset all to available" (owner/admin only). Returns number of items changed.
create function public.reset_all_availability(p_restaurant_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_count integer;
begin
  if not private.has_role(p_restaurant_id, 'owner', 'admin') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  update public.items set availability = 'available', availability_note = null,
                          remaining_qty = null, availability_until = null
  where restaurant_id = p_restaurant_id and availability <> 'available';
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

---------------------------------------------------------------------------------------------
-- Cron / operations (service role only)
---------------------------------------------------------------------------------------------

-- Revert overrides whose "until" has passed. Returns affected restaurant ids (for revalidation).
create function public.expire_availability()
returns setof uuid
language sql security definer set search_path = ''
as $$
  update public.items set availability = 'available', availability_note = null,
                          remaining_qty = null, availability_until = null
  where availability <> 'available' and availability_until is not null and availability_until <= now()
  returning restaurant_id
$$;

-- QR landing: record an anonymous scan and return where to send the diner.
create function public.record_scan(p_slug text, p_ua_family text default null, p_is_bot boolean default false)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_qr public.qr_codes%rowtype;
begin
  select * into v_qr from public.qr_codes where slug = p_slug and is_active;
  if not found then
    return null;
  end if;
  insert into public.scan_events (qr_code_id, ua_family, is_bot)
  values (v_qr.id, left(p_ua_family, 40), coalesce(p_is_bot, false));
  return v_qr.target_path;
end
$$;

-- Keep-alive target for the cron (prevents the free-tier 7-day pause).
create function public.health()
returns boolean
language sql stable set search_path = ''
as $$ select true $$;

---------------------------------------------------------------------------------------------
-- Execute privileges: functions are executable by PUBLIC by default — lock them down.
---------------------------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

grant execute on function public.menu_json(text, text) to anon, authenticated;
grant execute on function public.item_json(text, text, text) to anon, authenticated;
grant execute on function public.record_scan(text, text, boolean) to anon, authenticated;
grant execute on function public.health() to anon, authenticated;
grant execute on function public.availability_rank(public.availability_state) to anon, authenticated;
grant execute on function public.effective_availability(public.availability_state, timestamptz) to anon, authenticated;
grant execute on function public.set_item_availability(uuid, public.availability_state, text, integer, timestamptz, timestamptz) to authenticated;
grant execute on function public.reset_all_availability(uuid) to authenticated;
-- expire_availability: service_role only (it keeps its default grant).
grant execute on function public.expire_availability() to service_role;

-- RLS policies call these helpers as the querying role.
grant execute on function private.member_role(uuid), private.has_role(uuid, public.app_role[]),
  private.is_member(uuid), private.restaurant_is_public(uuid), private.category_is_public(uuid),
  private.item_is_public(uuid)
  to anon, authenticated;
