-- Content management RPCs (Phase 5). All SECURITY INVOKER: they run as the signed-in user, so
-- RLS decides (owner/admin may edit; staff/anon may not). Each save is one transaction.
-- Optimistic concurrency: pass the updated_at you loaded; a stale save raises 40001.

-- Keep translation rows tidy: insert/update non-empty, delete all-empty.
create function private.upsert_item_translations(p_item_id uuid, p_translations jsonb)
returns void language plpgsql set search_path = ''
as $$
declare loc text; t jsonb;
begin
  foreach loc in array array['fa', 'fr'] loop
    t := coalesce(p_translations -> loc, '{}'::jsonb);
    if coalesce(nullif(trim(t ->> 'name'), ''), nullif(trim(t ->> 'short_description'), ''),
                nullif(trim(t ->> 'long_description'), ''), nullif(trim(t ->> 'availability_note'), '')) is null then
      delete from public.item_translations where item_id = p_item_id and locale = loc;
    else
      insert into public.item_translations (item_id, locale, name, short_description, long_description, availability_note)
      values (p_item_id, loc, nullif(trim(t ->> 'name'), ''), nullif(trim(t ->> 'short_description'), ''),
              nullif(trim(t ->> 'long_description'), ''), nullif(trim(t ->> 'availability_note'), ''))
      on conflict (item_id, locale) do update set
        name = excluded.name, short_description = excluded.short_description,
        long_description = excluded.long_description, availability_note = excluded.availability_note;
    end if;
  end loop;
end
$$;

-- Create or update a dish with its translations, tags and variants, atomically.
create function public.save_item(
  p_id uuid,
  p_restaurant_id uuid,
  p_data jsonb,
  p_translations jsonb,
  p_tag_ids uuid[],
  p_variants jsonb,
  p_expected_updated_at timestamptz default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_existing public.items%rowtype;
  v_row public.items%rowtype;
  v jsonb;
  v_keep uuid[] := '{}';
  v_vid uuid;
begin
  select * into v_existing from public.items where id = p_id for update;

  if found then
    if p_expected_updated_at is not null and v_existing.updated_at <> p_expected_updated_at then
      raise exception 'item was changed by someone else' using errcode = '40001';
    end if;
    update public.items set
      category_id = (p_data ->> 'category_id')::uuid,
      name = p_data ->> 'name',
      slug = p_data ->> 'slug',
      short_description = nullif(p_data ->> 'short_description', ''),
      long_description = nullif(p_data ->> 'long_description', ''),
      price_cents = (p_data ->> 'price_cents')::integer,
      icon_key = nullif(p_data ->> 'icon_key', ''),
      hero_key = nullif(p_data ->> 'hero_key', ''),
      icon_lqip = nullif(p_data ->> 'icon_lqip', ''),
      hero_lqip = nullif(p_data ->> 'hero_lqip', ''),
      prep_minutes = (p_data ->> 'prep_minutes')::integer,
      calories = (p_data ->> 'calories')::integer,
      spice_level = coalesce((p_data ->> 'spice_level')::smallint, 0),
      is_featured = coalesce((p_data ->> 'is_featured')::boolean, false),
      is_published = coalesce((p_data ->> 'is_published')::boolean, true)
    where id = p_id
    returning * into v_row;
    if not found then
      raise exception 'permission denied' using errcode = '42501';
    end if;
  else
    insert into public.items (id, restaurant_id, category_id, name, slug, short_description, long_description,
      price_cents, icon_key, hero_key, icon_lqip, hero_lqip, prep_minutes, calories, spice_level,
      is_featured, is_published, sort_order)
    values (p_id, p_restaurant_id, (p_data ->> 'category_id')::uuid, p_data ->> 'name', p_data ->> 'slug',
      nullif(p_data ->> 'short_description', ''), nullif(p_data ->> 'long_description', ''),
      (p_data ->> 'price_cents')::integer, nullif(p_data ->> 'icon_key', ''), nullif(p_data ->> 'hero_key', ''),
      nullif(p_data ->> 'icon_lqip', ''), nullif(p_data ->> 'hero_lqip', ''),
      (p_data ->> 'prep_minutes')::integer, (p_data ->> 'calories')::integer,
      coalesce((p_data ->> 'spice_level')::smallint, 0), coalesce((p_data ->> 'is_featured')::boolean, false),
      coalesce((p_data ->> 'is_published')::boolean, true),
      coalesce((select max(sort_order) + 1 from public.items where category_id = (p_data ->> 'category_id')::uuid), 1))
    returning * into v_row;
  end if;

  perform private.upsert_item_translations(v_row.id, p_translations);

  -- Tags: exactly the given set (only tags of this restaurant).
  delete from public.item_tags where item_id = v_row.id and tag_id <> all (coalesce(p_tag_ids, '{}'));
  insert into public.item_tags (item_id, tag_id)
  select v_row.id, t.id from public.tags t
  where t.id = any (coalesce(p_tag_ids, '{}')) and t.restaurant_id = v_row.restaurant_id
  on conflict do nothing;

  -- Variants: update given ids, insert new, delete the rest.
  for v in select * from jsonb_array_elements(coalesce(p_variants, '[]'::jsonb)) loop
    v_vid := nullif(v ->> 'id', '')::uuid;
    if v_vid is not null and exists (select 1 from public.item_variants where id = v_vid and item_id = v_row.id) then
      update public.item_variants set name = v ->> 'name', price_delta_cents = (v ->> 'price_delta_cents')::integer,
        availability = coalesce((v ->> 'availability')::public.availability_state, 'available'),
        sort_order = (v ->> 'sort_order')::integer
      where id = v_vid;
    else
      insert into public.item_variants (item_id, name, price_delta_cents, availability, sort_order)
      values (v_row.id, v ->> 'name', (v ->> 'price_delta_cents')::integer,
        coalesce((v ->> 'availability')::public.availability_state, 'available'), (v ->> 'sort_order')::integer)
      returning id into v_vid;
    end if;
    v_keep := v_keep || v_vid;
  end loop;
  delete from public.item_variants where item_id = v_row.id and id <> all (v_keep);

  -- Re-read: child writes don't touch items.updated_at, but the item row did change above.
  select * into v_row from public.items where id = v_row.id;
  return jsonb_build_object('id', v_row.id, 'updated_at', v_row.updated_at, 'slug', v_row.slug);
end
$$;

-- Create or update a category with translations.
create function public.save_category(
  p_id uuid,
  p_restaurant_id uuid,
  p_data jsonb,
  p_translations jsonb,
  p_expected_updated_at timestamptz default null
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_existing public.categories%rowtype;
  v_row public.categories%rowtype;
  loc text; t jsonb;
begin
  select * into v_existing from public.categories where id = p_id for update;
  if found then
    if p_expected_updated_at is not null and v_existing.updated_at <> p_expected_updated_at then
      raise exception 'category was changed by someone else' using errcode = '40001';
    end if;
    update public.categories set name = p_data ->> 'name', slug = p_data ->> 'slug',
      description = nullif(p_data ->> 'description', ''),
      is_published = coalesce((p_data ->> 'is_published')::boolean, true)
    where id = p_id returning * into v_row;
    if not found then raise exception 'permission denied' using errcode = '42501'; end if;
  else
    insert into public.categories (id, restaurant_id, name, slug, description, is_published, sort_order)
    values (p_id, p_restaurant_id, p_data ->> 'name', p_data ->> 'slug', nullif(p_data ->> 'description', ''),
      coalesce((p_data ->> 'is_published')::boolean, true),
      coalesce((select max(sort_order) + 1 from public.categories where restaurant_id = p_restaurant_id), 1))
    returning * into v_row;
  end if;

  foreach loc in array array['fa', 'fr'] loop
    t := coalesce(p_translations -> loc, '{}'::jsonb);
    if coalesce(nullif(trim(t ->> 'name'), ''), nullif(trim(t ->> 'description'), '')) is null then
      delete from public.category_translations where category_id = v_row.id and locale = loc;
    else
      insert into public.category_translations (category_id, locale, name, description)
      values (v_row.id, loc, nullif(trim(t ->> 'name'), ''), nullif(trim(t ->> 'description'), ''))
      on conflict (category_id, locale) do update set name = excluded.name, description = excluded.description;
    end if;
  end loop;
  return jsonb_build_object('id', v_row.id, 'updated_at', v_row.updated_at);
end
$$;

-- Create or update a tag/label with translations.
create function public.save_tag(p_id uuid, p_restaurant_id uuid, p_data jsonb, p_translations jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare v_row public.tags%rowtype; loc text; v_label text;
begin
  if exists (select 1 from public.tags where id = p_id) then
    update public.tags set label = p_data ->> 'label', kind = (p_data ->> 'kind')::public.tag_kind,
      icon = nullif(p_data ->> 'icon', '')
    where id = p_id returning * into v_row;
    if not found then raise exception 'permission denied' using errcode = '42501'; end if;
  else
    insert into public.tags (id, restaurant_id, label, kind, icon, sort_order)
    values (p_id, p_restaurant_id, p_data ->> 'label', (p_data ->> 'kind')::public.tag_kind,
      nullif(p_data ->> 'icon', ''),
      coalesce((select max(sort_order) + 1 from public.tags where restaurant_id = p_restaurant_id
                and kind = (p_data ->> 'kind')::public.tag_kind), 1))
    returning * into v_row;
  end if;
  foreach loc in array array['fa', 'fr'] loop
    v_label := nullif(trim(p_translations ->> loc), '');
    if v_label is null then
      delete from public.tag_translations where tag_id = v_row.id and locale = loc;
    else
      insert into public.tag_translations (tag_id, locale, label) values (v_row.id, loc, v_label)
      on conflict (tag_id, locale) do update set label = excluded.label;
    end if;
  end loop;
  return jsonb_build_object('id', v_row.id, 'updated_at', v_row.updated_at);
end
$$;

-- Set sort_order from the order of ids (1, 2, 3…). RLS limits which rows can change.
create function public.reorder_categories(p_ids uuid[])
returns integer language sql security invoker set search_path = ''
as $$
  with o as (select id, ord from unnest(p_ids) with ordinality as x(id, ord)),
  u as (update public.categories c set sort_order = o.ord from o where c.id = o.id and c.sort_order <> o.ord returning 1)
  select count(*)::integer from u
$$;

create function public.reorder_items(p_ids uuid[])
returns integer language sql security invoker set search_path = ''
as $$
  with o as (select id, ord from unnest(p_ids) with ordinality as x(id, ord)),
  u as (update public.items i set sort_order = o.ord from o where i.id = o.id and i.sort_order <> o.ord returning 1)
  select count(*)::integer from u
$$;

create function public.set_items_published(p_ids uuid[], p_published boolean)
returns integer language sql security invoker set search_path = ''
as $$
  with u as (update public.items set is_published = p_published
             where id = any (p_ids) and is_published <> p_published returning 1)
  select count(*)::integer from u
$$;

revoke execute on function private.upsert_item_translations(uuid, jsonb) from public, anon;
grant execute on function private.upsert_item_translations(uuid, jsonb) to authenticated;
grant execute on function public.save_item(uuid, uuid, jsonb, jsonb, uuid[], jsonb, timestamptz) to authenticated;
grant execute on function public.save_category(uuid, uuid, jsonb, jsonb, timestamptz) to authenticated;
grant execute on function public.save_tag(uuid, uuid, jsonb, jsonb) to authenticated;
grant execute on function public.reorder_categories(uuid[]) to authenticated;
grant execute on function public.reorder_items(uuid[]) to authenticated;
grant execute on function public.set_items_published(uuid[], boolean) to authenticated;
