-- Guests never see an empty category (e.g. one just created in the CMS, before it has dishes).
create or replace function public.menu_json(p_restaurant_slug text, p_locale text default 'en')
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
      -- Empty sections (no visible dishes yet) are not shown to guests.
      where c.is_published and exists (select 1 from item_list i where i.category_id = c.id)), '[]'::jsonb)
  )
  where exists (select 1 from r)
$$;
