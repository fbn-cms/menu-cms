-- Live availability goes over a PRIVATE broadcast channel. On a public channel any client
-- holding the publishable key could also *send* fake "sold out" messages to every diner.
-- Diners (anon) may receive menu broadcasts; nobody may send from the client.

create or replace function private.broadcast_availability()
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
      true -- private channel
    );
  end if;
  return null;
end
$$;

create policy "diners receive menu broadcasts" on realtime.messages
  for select to anon, authenticated
  using (realtime.topic() like 'menu:%' and extension = 'broadcast');
-- No INSERT policy: clients cannot broadcast on menu channels.
