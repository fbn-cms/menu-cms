# Security model

## Who can do what (enforced in Postgres, not the UI)

| Action                                                                   | owner | admin | staff         | diner (anon) |
| ------------------------------------------------------------------------ | ----- | ----- | ------------- | ------------ |
| Read published menu                                                      | ✅    | ✅    | ✅            | ✅           |
| Set availability / note / qty / until                                    | ✅    | ✅    | ✅ (RPC only) | ❌           |
| Reset all to available                                                   | ✅    | ✅    | ❌            | ❌           |
| Items, categories, prices, variants, images, tags, translations, publish | ✅    | ✅    | ❌            | ❌           |
| QR codes, scan counts                                                    | ✅    | ✅    | ❌            | ❌           |
| Restaurant settings                                                      | ✅    | ❌    | ❌            | ❌           |
| Team (roles, deactivate)                                                 | ✅    | ❌    | ❌            | ❌           |
| Audit log                                                                | ✅    | ❌    | ❌            | ❌           |

The `viewer` role from the original spec was dropped (owner decision, 2026-10-11).

## How the staff boundary is enforced — three layers

1. **RLS:** there is no UPDATE policy on `items` for staff. A staff `UPDATE items …` matches zero rows.
2. **RPC:** staff change availability only through `public.set_item_availability()`, which
   checks membership and writes only the four availability columns.
3. **Trigger:** `private.guard_item_update` (BEFORE UPDATE) raises `42501` if anyone who is
   not owner/admin changes any column other than `availability`, `availability_note`,
   `remaining_qty`, `availability_until` — even through a path that bypasses RLS.

**Deviation from the spec:** the spec asked for a column-level `GRANT UPDATE (…) ON items` for
the _staff role_. In Supabase every signed-in user is the same Postgres role
(`authenticated`), so a column grant cannot distinguish staff from admin. We use column grants
where they _do_ work: system columns (`id`, `restaurant_id`, `updated_by`, timestamps) are not
updatable through the API by anyone, and anon cannot read `items.updated_by`.

## Other rules

- Diners (anon) can never write, and cannot read `profiles`, `audit_log`, `scan_events`,
  `qr_codes`, `image_deletions`, or any unpublished row.
- All functions are `REVOKE EXECUTE … FROM PUBLIC`; only listed RPCs are granted.
- Every write is recorded in `audit_log` by trigger (availability changes as `availability`).
- An owner cannot demote or deactivate themselves (prevents lock-out).
- Live updates use Realtime **Broadcast** with only the availability fields, not full rows.
- Secrets: `SUPABASE_SECRET_KEY` is server-only; `npm run check:secrets` fails the build if
  `sb_secret_` or `SERVICE_ROLE` appears in client output.

## Tests

`npm run db:test` — pgTAP suites in `supabase/tests/database/` (54 assertions): every row of
the matrix above, the trigger layer, anon leakage, ordering rule, locale fallback, expiry.
