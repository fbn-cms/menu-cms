-- Row Level Security — implements the permission matrix in the build spec §3.
--   owner : everything incl. settings, users, audit log
--   admin : full menu editing, QR codes; no settings, users, audit
--   staff : availability only, via public.set_item_availability() (no direct table writes)
--   anon  : SELECT published rows only (diners; no sign-up)

---------------------------------------------------------------------------------------------
-- Privileges (defence in depth beneath RLS)
---------------------------------------------------------------------------------------------
-- Diners never write anything, and never see internal tables.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke all on public.profiles, public.audit_log, public.scan_events, public.image_deletions,
              public.qr_codes from anon;
-- Logs and the deletion queue are written only by SECURITY DEFINER code.
revoke insert, update, delete on public.audit_log, public.scan_events, public.image_deletions
  from authenticated;
revoke select on public.image_deletions from authenticated;
-- Profiles are created by the server (service role) when the owner invites someone.
revoke insert, delete on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, role, is_active) on public.profiles to authenticated;

-- Items: system columns are never writable through the API; anon can't read updated_by.
revoke update on public.items from authenticated;
grant update (category_id, name, slug, short_description, long_description, price_cents, currency,
              icon_key, hero_key, icon_lqip, hero_lqip, availability, remaining_qty,
              availability_note, availability_until, prep_minutes, calories, spice_level,
              is_featured, is_published, sort_order)
  on public.items to authenticated;
revoke select on public.items from anon;
grant select (id, restaurant_id, category_id, name, slug, short_description, long_description,
              price_cents, currency, icon_key, hero_key, icon_lqip, hero_lqip, availability,
              remaining_qty, availability_note, availability_until, prep_minutes, calories,
              spice_level, is_featured, is_published, sort_order, created_at, updated_at)
  on public.items to anon;

-- Restaurants are created by the service role, never via the API.
revoke insert, delete on public.restaurants from authenticated;

-- Future tables start closed to anon.
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon;

---------------------------------------------------------------------------------------------
-- restaurants
---------------------------------------------------------------------------------------------
create policy "public reads published restaurants" on public.restaurants
  for select to anon, authenticated using (is_published);
create policy "members read their restaurant" on public.restaurants
  for select to authenticated using (private.is_member(id));
create policy "owner updates settings" on public.restaurants
  for update to authenticated
  using (private.has_role(id, 'owner')) with check (private.has_role(id, 'owner'));

---------------------------------------------------------------------------------------------
-- categories
---------------------------------------------------------------------------------------------
create policy "public reads published categories" on public.categories
  for select to anon, authenticated using (private.category_is_public(id));
create policy "members read categories" on public.categories
  for select to authenticated using (private.is_member(restaurant_id));
create policy "editors insert categories" on public.categories
  for insert to authenticated with check (private.has_role(restaurant_id, 'owner', 'admin'));
create policy "editors update categories" on public.categories
  for update to authenticated
  using (private.has_role(restaurant_id, 'owner', 'admin'))
  with check (private.has_role(restaurant_id, 'owner', 'admin'));
create policy "editors delete categories" on public.categories
  for delete to authenticated using (private.has_role(restaurant_id, 'owner', 'admin'));

---------------------------------------------------------------------------------------------
-- items (staff have NO update policy: they use public.set_item_availability)
---------------------------------------------------------------------------------------------
create policy "public reads published items" on public.items
  for select to anon, authenticated using (is_published and private.category_is_public(category_id));
create policy "members read items" on public.items
  for select to authenticated using (private.is_member(restaurant_id));
create policy "editors insert items" on public.items
  for insert to authenticated with check (private.has_role(restaurant_id, 'owner', 'admin'));
create policy "editors update items" on public.items
  for update to authenticated
  using (private.has_role(restaurant_id, 'owner', 'admin'))
  with check (private.has_role(restaurant_id, 'owner', 'admin'));
create policy "editors delete items" on public.items
  for delete to authenticated using (private.has_role(restaurant_id, 'owner', 'admin'));

---------------------------------------------------------------------------------------------
-- Children of items: variants, item_tags, item_translations
---------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['item_variants', 'item_tags', 'item_translations'] loop
    execute format($f$
      create policy "public reads published %1$s" on public.%1$I
        for select to anon, authenticated using (private.item_is_public(item_id));
      create policy "members read %1$s" on public.%1$I
        for select to authenticated using (
          private.is_member((select i.restaurant_id from public.items i where i.id = item_id)));
      create policy "editors write %1$s" on public.%1$I
        for all to authenticated
        using (private.has_role((select i.restaurant_id from public.items i where i.id = item_id), 'owner', 'admin'))
        with check (private.has_role((select i.restaurant_id from public.items i where i.id = item_id), 'owner', 'admin'));
    $f$, t);
  end loop;
end
$$;

---------------------------------------------------------------------------------------------
-- category_translations
---------------------------------------------------------------------------------------------
create policy "public reads published category_translations" on public.category_translations
  for select to anon, authenticated using (private.category_is_public(category_id));
create policy "members read category_translations" on public.category_translations
  for select to authenticated using (
    private.is_member((select c.restaurant_id from public.categories c where c.id = category_id)));
create policy "editors write category_translations" on public.category_translations
  for all to authenticated
  using (private.has_role((select c.restaurant_id from public.categories c where c.id = category_id), 'owner', 'admin'))
  with check (private.has_role((select c.restaurant_id from public.categories c where c.id = category_id), 'owner', 'admin'));

---------------------------------------------------------------------------------------------
-- tags + tag_translations
---------------------------------------------------------------------------------------------
create policy "public reads tags of published restaurants" on public.tags
  for select to anon, authenticated using (private.restaurant_is_public(restaurant_id));
create policy "members read tags" on public.tags
  for select to authenticated using (private.is_member(restaurant_id));
create policy "editors write tags" on public.tags
  for all to authenticated
  using (private.has_role(restaurant_id, 'owner', 'admin'))
  with check (private.has_role(restaurant_id, 'owner', 'admin'));

create policy "public reads tag_translations" on public.tag_translations
  for select to anon, authenticated using (
    private.restaurant_is_public((select t.restaurant_id from public.tags t where t.id = tag_id)));
create policy "members read tag_translations" on public.tag_translations
  for select to authenticated using (
    private.is_member((select t.restaurant_id from public.tags t where t.id = tag_id)));
create policy "editors write tag_translations" on public.tag_translations
  for all to authenticated
  using (private.has_role((select t.restaurant_id from public.tags t where t.id = tag_id), 'owner', 'admin'))
  with check (private.has_role((select t.restaurant_id from public.tags t where t.id = tag_id), 'owner', 'admin'));

---------------------------------------------------------------------------------------------
-- profiles: everyone reads their own row; owner reads and manages the team
---------------------------------------------------------------------------------------------
create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "owner reads team" on public.profiles
  for select to authenticated using (private.has_role(restaurant_id, 'owner'));
create policy "owner updates team" on public.profiles
  for update to authenticated
  using (private.has_role(restaurant_id, 'owner'))
  with check (private.has_role(restaurant_id, 'owner'));

---------------------------------------------------------------------------------------------
-- QR codes, scans, audit
---------------------------------------------------------------------------------------------
create policy "editors manage qr codes" on public.qr_codes
  for all to authenticated
  using (private.has_role(restaurant_id, 'owner', 'admin'))
  with check (private.has_role(restaurant_id, 'owner', 'admin'));

create policy "editors read scan counts" on public.scan_events
  for select to authenticated using (
    private.has_role((select q.restaurant_id from public.qr_codes q where q.id = qr_code_id), 'owner', 'admin'));

create policy "owner reads audit log" on public.audit_log
  for select to authenticated using (private.has_role(restaurant_id, 'owner'));

-- image_deletions: no policies → only the service role (cron) can touch it.
