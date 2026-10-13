-- Owner request 2026-10-14:
--  * "Chef's pick" (items.is_featured) moves to the 86 board, so staff may toggle it.
--    The staff boundary widens by exactly that one column (guard trigger), via its own RPC.
--  * Size/option (variant) names become translatable (for AI-assisted translation).

create or replace function private.guard_item_update()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  -- The 86 board: availability + "Chef's pick" (is_featured), nothing else.
  allowed constant text[] := array['availability','availability_note','remaining_qty',
                                   'availability_until','is_featured','updated_at','updated_by'];
begin
  if (select auth.uid()) is not null
     and not private.has_role(old.restaurant_id, 'owner', 'admin')
     and (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'permission denied: only availability and Chef''s pick may be changed by this role'
      using errcode = '42501';
  end if;
  if (select auth.uid()) is not null then
    new.updated_by := (select auth.uid());
  end if;
  return new;
end
$$;

create or replace function private.write_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_ignore constant text[] := array['updated_at','updated_by'];
  v_avail constant text[] := array['availability','availability_note','remaining_qty','availability_until'];
  v_action text := lower(tg_op);
begin
  if tg_op = 'UPDATE' then
    if (v_old - v_ignore) = (v_new - v_ignore) then
      return null; -- no-op update
    end if;
    if tg_table_name = 'items' and (v_old - v_ignore - v_avail) = (v_new - v_ignore - v_avail) then
      v_action := 'availability';
    elsif tg_table_name = 'items'
          and (v_old - v_ignore - v_avail - 'is_featured') = (v_new - v_ignore - v_avail - 'is_featured') then
      v_action := 'feature';
    end if;
  end if;

  insert into public.audit_log (restaurant_id, actor_id, action, entity, entity_id, before_json, after_json)
  values (
    private.restaurant_of(tg_table_name, v_row),
    (select auth.uid()),
    v_action,
    tg_table_name,
    coalesce(v_row ->> 'id',
             concat_ws(':', v_row ->> 'item_id', v_row ->> 'category_id', v_row ->> 'tag_id', v_row ->> 'locale')),
    v_old,
    v_new
  );
  return null;
end
$$;

create or replace function private.broadcast_availability()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (new.availability, new.availability_note, new.remaining_qty, new.availability_until, new.is_featured)
     is distinct from (old.availability, old.availability_note, old.remaining_qty, old.availability_until, old.is_featured)
     and private.item_is_public(new.id) then
    perform realtime.send(
      jsonb_build_object(
        'id', new.id,
        'category_id', new.category_id,
        'availability', public.effective_availability(new.availability, new.availability_until),
        'availability_note', new.availability_note,
        'remaining_qty', new.remaining_qty,
        'availability_until', new.availability_until,
        'is_featured', new.is_featured
      ),
      'availability',
      'menu:' || new.restaurant_id::text,
      true -- private channel
    );
  end if;
  return null;
end
$$;

-- 86 board: toggle Chef's pick. Owner, admin and staff.
create function public.set_item_featured(p_item_id uuid, p_featured boolean, p_expected_updated_at timestamptz default null)
returns table (id uuid, is_featured boolean, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare v_item public.items%rowtype;
begin
  select * into v_item from public.items i where i.id = p_item_id for update;
  if not found or not private.has_role(v_item.restaurant_id, 'owner', 'admin', 'staff') then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
  if p_expected_updated_at is not null and v_item.updated_at <> p_expected_updated_at then
    raise exception 'item was changed by someone else' using errcode = '40001';
  end if;
  return query
  update public.items i set is_featured = p_featured where i.id = p_item_id
  returning i.id, i.is_featured, i.updated_at;
end
$$;
revoke execute on function public.set_item_featured(uuid, boolean, timestamptz) from public, anon;
grant execute on function public.set_item_featured(uuid, boolean, timestamptz) to authenticated;

-- Variant name translations ('en' stays on item_variants.name).
create table public.item_variant_translations (
  variant_id uuid not null references public.item_variants (id) on delete cascade,
  locale public.translation_locale not null,
  name text check (length(name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (variant_id, locale)
);
alter table public.item_variant_translations enable row level security;
create trigger set_updated_at before update on public.item_variant_translations
  for each row execute function private.set_updated_at();
revoke insert, update, delete, truncate, references, trigger on public.item_variant_translations from anon;

create policy "public reads published item_variant_translations" on public.item_variant_translations
  for select to anon, authenticated using (
    private.item_is_public((select v.item_id from public.item_variants v where v.id = variant_id)));
create policy "members read item_variant_translations" on public.item_variant_translations
  for select to authenticated using (
    private.is_member((select i.restaurant_id from public.item_variants v join public.items i on i.id = v.item_id where v.id = variant_id)));
create policy "editors write item_variant_translations" on public.item_variant_translations
  for all to authenticated
  using (private.has_role((select i.restaurant_id from public.item_variants v join public.items i on i.id = v.item_id where v.id = variant_id), 'owner', 'admin'))
  with check (private.has_role((select i.restaurant_id from public.item_variants v join public.items i on i.id = v.item_id where v.id = variant_id), 'owner', 'admin'));

create function private.upsert_variant_translations(p_variant_id uuid, p_translations jsonb)
returns void language plpgsql set search_path = ''
as $$
declare loc text; v_name text;
begin
  foreach loc in array array['fa', 'fr'] loop
    v_name := nullif(trim(coalesce(p_translations, '{}'::jsonb) ->> loc), '');
    if v_name is null then
      delete from public.item_variant_translations where variant_id = p_variant_id and locale = loc;
    else
      insert into public.item_variant_translations (variant_id, locale, name) values (p_variant_id, loc, v_name)
      on conflict (variant_id, locale) do update set name = excluded.name;
    end if;
  end loop;
end
$$;
revoke execute on function private.upsert_variant_translations(uuid, jsonb) from public, anon;
grant execute on function private.upsert_variant_translations(uuid, jsonb) to authenticated;

create or replace function public.save_item(
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
      -- is_featured is set on the 86 board (set_item_featured), never by the editor.
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
      coalesce((p_data ->> 'spice_level')::smallint, 0), false,
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
    perform private.upsert_variant_translations(v_vid, v -> 'translations');
    v_keep := v_keep || v_vid;
  end loop;
  delete from public.item_variants where item_id = v_row.id and id <> all (v_keep);

  -- Re-read: child writes don't touch items.updated_at, but the item row did change above.
  select * into v_row from public.items where id = v_row.id;
  return jsonb_build_object('id', v_row.id, 'updated_at', v_row.updated_at, 'slug', v_row.slug);
end
$$;

create or replace function public.item_json(p_restaurant_slug text, p_item_slug text, p_locale text default 'en')
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
      select jsonb_agg(jsonb_build_object('id', v.id,
                                          'name', coalesce((select nullif(vt.name, '') from public.item_variant_translations vt
                                                            where vt.variant_id = v.id and vt.locale = p_locale), v.name),
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
