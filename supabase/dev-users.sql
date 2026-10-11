-- LOCAL DEVELOPMENT ONLY — never run against demo or production.
-- Creates owner/admin/staff test accounts, password: local-dev-password
-- (or use a magic link; emails land in Mailpit at http://127.0.0.1:54324).
do $$
declare
  u record;
begin
  for u in select * from (values
    ('00000000-0000-4000-8000-0000000000aa'::uuid, 'owner@demo.test', 'Olivia Owner', 'owner'::public.app_role),
    ('00000000-0000-4000-8000-0000000000ab'::uuid, 'admin@demo.test', 'Adam Admin', 'admin'::public.app_role),
    ('00000000-0000-4000-8000-0000000000ac'::uuid, 'staff@demo.test', 'Sam Staff', 'staff'::public.app_role)
  ) as t(id, email, full_name, role)
  loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values (u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email,
      extensions.crypt('local-dev-password', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name), now(), now(),
      '', '', '', '')
    on conflict (id) do nothing;
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
    values (gen_random_uuid(), u.id, u.id::text, 'email',
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now())
    on conflict do nothing;
    insert into public.profiles (id, restaurant_id, email, full_name, role)
    values (u.id, '00000000-0000-4000-8000-000000000001', u.email, u.full_name, u.role)
    on conflict (id) do nothing;
  end loop;
end
$$;
truncate public.audit_log;
