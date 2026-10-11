-- Helpers, triggers, audit logging. Role checks live in the `private` schema, which the
-- Data API does not expose; SECURITY DEFINER avoids RLS recursion on `profiles`.

grant usage on schema private to anon, authenticated, service_role;

-- Caller's role in a restaurant, or NULL if not an active member.
create function private.member_role(p_restaurant_id uuid)
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p
  where p.id = (select auth.uid()) and p.restaurant_id = p_restaurant_id and p.is_active
$$;

create function private.has_role(p_restaurant_id uuid, variadic p_roles public.app_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.member_role(p_restaurant_id) = any (p_roles), false)
$$;

create function private.is_member(p_restaurant_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.member_role(p_restaurant_id) is not null
$$;

-- Public visibility chain: item → category → restaurant must all be published.
create function private.restaurant_is_public(p_restaurant_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.restaurants r where r.id = p_restaurant_id and r.is_published)
$$;

create function private.category_is_public(p_category_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.categories c
    join public.restaurants r on r.id = c.restaurant_id
    where c.id = p_category_id and c.is_published and r.is_published
  )
$$;

create function private.item_is_public(p_item_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.items i
    join public.categories c on c.id = i.category_id
    join public.restaurants r on r.id = i.restaurant_id
    where i.id = p_item_id and i.is_published and c.is_published and r.is_published
  )
$$;

-- Restaurant that owns a row of any audited table (for audit_log.restaurant_id).
create function private.restaurant_of(p_table text, p_row jsonb)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  return case p_table
    when 'restaurants' then (p_row ->> 'id')::uuid
    when 'item_variants' then (select restaurant_id from public.items where id = (p_row ->> 'item_id')::uuid)
    when 'item_tags' then (select restaurant_id from public.items where id = (p_row ->> 'item_id')::uuid)
    when 'item_translations' then (select restaurant_id from public.items where id = (p_row ->> 'item_id')::uuid)
    when 'category_translations' then (select restaurant_id from public.categories where id = (p_row ->> 'category_id')::uuid)
    when 'tag_translations' then (select restaurant_id from public.tags where id = (p_row ->> 'tag_id')::uuid)
    else (p_row ->> 'restaurant_id')::uuid
  end;
end
$$;

-- Ordering rule (spec §3): available → limited → unavailable, then sort_order, then name.
-- Mirrored in src/lib/menu/ordering.ts for client-side re-sorting after realtime updates.
create function public.availability_rank(p_state public.availability_state)
returns smallint
language sql immutable parallel safe set search_path = ''
as $$
  select case p_state when 'available' then 0 when 'limited' then 1 when 'unavailable' then 2 end::smallint
$$;

-- An override whose "until" has passed counts as available even before the cron clears it.
create function public.effective_availability(p_state public.availability_state, p_until timestamptz)
returns public.availability_state
language sql stable set search_path = ''
as $$
  select case when p_state <> 'available' and p_until is not null and p_until <= now()
              then 'available'::public.availability_state else p_state end
$$;

---------------------------------------------------------------------------------------------
-- Generic triggers
---------------------------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

do $$
declare t text;
begin
  foreach t in array array['restaurants','categories','profiles','items','item_variants','tags',
    'item_tags','item_translations','category_translations','tag_translations','qr_codes']
  loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function private.set_updated_at()', t);
  end loop;
end
$$;

-- THE staff boundary (spec §3). Anyone who is not owner/admin may change only the four
-- availability columns on items. Applies to every path (direct UPDATE, RPC, future policies).
-- Calls without a JWT (migrations, service-role cron) have auth.uid() = NULL and are not limited.
create function private.guard_item_update()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  allowed constant text[] := array['availability','availability_note','remaining_qty',
                                   'availability_until','updated_at','updated_by'];
begin
  if (select auth.uid()) is not null
     and not private.has_role(old.restaurant_id, 'owner', 'admin')
     and (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'permission denied: only availability fields may be changed by this role'
      using errcode = '42501';
  end if;
  if (select auth.uid()) is not null then
    new.updated_by := (select auth.uid());
  end if;
  return new;
end
$$;

create trigger guard_item_update before update on public.items
  for each row execute function private.guard_item_update();

-- Protect profiles from lock-out and privilege games: id/restaurant are immutable, and an
-- owner cannot demote or deactivate themselves.
create function private.guard_profile_update()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.id <> old.id or new.restaurant_id <> old.restaurant_id then
    raise exception 'profile id and restaurant cannot change' using errcode = '42501';
  end if;
  if (select auth.uid()) = old.id and (new.role <> old.role or new.is_active <> old.is_active) then
    raise exception 'you cannot change your own role or deactivate yourself' using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger guard_profile_update before update on public.profiles
  for each row execute function private.guard_profile_update();

-- Audit every write. Availability-only changes on items get action 'availability' so the
-- owner can see who 86'd a dish and when.
create function private.write_audit()
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

do $$
declare t text;
begin
  foreach t in array array['restaurants','categories','profiles','items','item_variants','tags',
    'item_tags','item_translations','category_translations','tag_translations','qr_codes']
  loop
    execute format('create trigger write_audit after insert or update or delete on public.%I
                    for each row execute function private.write_audit()', t);
  end loop;
end
$$;

-- Queue replaced/deleted image keys for the nightly R2 cleanup.
create function private.enqueue_old_images()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  k text;
  v_old jsonb := to_jsonb(old);
  v_new jsonb := case when tg_op = 'UPDATE' then to_jsonb(new) else '{}'::jsonb end;
begin
  foreach k in array array['icon_key','hero_key','logo_key'] loop
    if v_old ->> k is not null and (v_new ->> k) is distinct from (v_old ->> k) then
      insert into public.image_deletions (key) values (v_old ->> k) on conflict do nothing;
    end if;
  end loop;
  return null;
end
$$;

create trigger enqueue_old_images after update or delete on public.items
  for each row execute function private.enqueue_old_images();
create trigger enqueue_old_images after update or delete on public.categories
  for each row execute function private.enqueue_old_images();
create trigger enqueue_old_images after update of logo_key or delete on public.restaurants
  for each row execute function private.enqueue_old_images();

-- Live availability for diners: broadcast only the public availability fields of published
-- items on a public channel `menu:<restaurant_id>`. (Not postgres_changes, which would ship
-- the full row incl. updated_by.)
create function private.broadcast_availability()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (new.availability, new.availability_note, new.remaining_qty, new.availability_until)
     is distinct from (old.availability, old.availability_note, old.remaining_qty, old.availability_until)
     and private.item_is_public(new.id) then
    perform realtime.send(
      jsonb_build_object(
        'id', new.id,
        'category_id', new.category_id,
        'availability', public.effective_availability(new.availability, new.availability_until),
        'availability_note', new.availability_note,
        'remaining_qty', new.remaining_qty,
        'availability_until', new.availability_until
      ),
      'availability',
      'menu:' || new.restaurant_id::text,
      false
    );
  end if;
  return null;
end
$$;

create trigger broadcast_availability after update on public.items
  for each row execute function private.broadcast_availability();
