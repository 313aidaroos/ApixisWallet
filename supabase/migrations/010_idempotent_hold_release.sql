-- 010_idempotent_hold_release.sql
-- 2026-09-28 Grok Developer Bot. Safe to re-run. Function bodies only: no table, row or grant changes,
-- and no ledger rows are updated or deleted (the ledger is append-only).
--
-- Bug: the release-holds cron (Vercel, 04:17 UTC = 11:17 PM CT) returned 500 on 2026-09-27 with
--   duplicate key value violates unique constraint "ledger_transactions_external_id_key".
-- Cause: two reservations from 2026-09-22 (external_id rsv_37ee71c2_1 / rsv_37ee71c2_2) were settled by
-- the pre-003 functions, which wrote the settlement row with external_id '<reserve>:capture' /
-- '<reserve>:release' and a "[res:<id>]" description but WITHOUT settles_reservation_id (that column
-- came later). Migration 007 then gave every "unsettled" reserve a one-day hold_expires_at, so
-- release_expired_holds() and reserve_xp()'s lazy release see them as open holds forever:
--   * the released one tries to insert '<reserve>:release' again -> unique_violation. The sweep only
--     caught WA409/WA404, so the whole sweep rolled back and the route answered 500 every night;
--   * the captured one would get a NEW ':release' row, handing back 800 Ixis that were already
--     spent. Only the rollback above prevented that double credit.
-- Fix:
--   1. release_hold_internal / capture_xp treat a legacy settlement row (same derived external_id) as the
--      settlement: release of a released hold returns it (idempotent), anything else raises WA409.
--   2. The sweep and reserve_xp's lazy release skip reserves that have a legacy settlement.
--   3. The sweep also catches unique_violation per hold (logged as a warning), so one bad row can never
--      fail the whole sweep again.
-- Undo: re-run the function definitions from 007_launch_hardening.sql (the nightly 500 comes back).

begin;

-- ---------------------------------------------------------------- release (shared by API, sweep, lazy)
create or replace function public.release_hold_internal(p_reservation_id uuid, p_description text, p_actor text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_res record; v_tx_id uuid; v_kind text; v_wallet_id uuid;
  v_held bigint; v_from_paid bigint; v_from_bonus bigint;
begin
  select id, app_slug, external_id, product_key into v_res
    from ledger_transactions where id = p_reservation_id and kind = 'reserve' for update;
  if not found then raise exception 'Reservation % not found', p_reservation_id using errcode = 'WA404'; end if;

  select id, kind into v_tx_id, v_kind from ledger_transactions where settles_reservation_id = p_reservation_id;
  if v_tx_id is null and v_res.external_id is not null then
    -- Legacy settlement written before settles_reservation_id existed.
    select id, kind into v_tx_id, v_kind from ledger_transactions
     where external_id in (v_res.external_id || ':release', v_res.external_id || ':capture')
       and kind in ('release', 'spend')
     order by (kind = 'spend') desc
     limit 1;
  end if;
  if v_tx_id is not null then
    if v_kind = 'release' then return v_tx_id; end if;
    raise exception 'Reservation % was already captured', p_reservation_id using errcode = 'WA409';
  end if;

  select wallet_id,
         coalesce(sum(amount) filter (where bucket = 'reserved'), 0),
         -coalesce(sum(amount) filter (where bucket = 'paid'), 0),
         -coalesce(sum(amount) filter (where bucket = 'bonus'), 0)
    into v_wallet_id, v_held, v_from_paid, v_from_bonus
    from ledger_entries where transaction_id = p_reservation_id group by wallet_id;
  if v_wallet_id is null or v_held <= 0 then
    raise exception 'No reserved Ixis found for reservation %', p_reservation_id using errcode = 'WA404';
  end if;
  v_from_bonus := least(greatest(v_from_bonus, 0), v_held);
  v_from_paid := v_held - v_from_bonus;

  begin
    insert into ledger_transactions (kind, description, app_slug, external_id, settles_reservation_id, product_key, actor)
    values ('release', p_description, v_res.app_slug, v_res.external_id || ':release', p_reservation_id, v_res.product_key, p_actor)
    returning id into v_tx_id;
  exception when unique_violation then
    raise exception 'Reservation % already has a settlement row', p_reservation_id using errcode = 'WA409';
  end;
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'reserved', -v_held);
  if v_from_paid > 0 then
    insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'paid', v_from_paid);
  end if;
  if v_from_bonus > 0 then
    insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'bonus', v_from_bonus);
  end if;
  return v_tx_id;
end $$;

-- ---------------------------------------------------------------- reserve (lazy release skips legacy-settled holds)
create or replace function public.reserve_xp(
  p_owner_id uuid,
  p_amount bigint,
  p_description text,
  p_external_id text,
  p_app_slug text default null,
  p_product_key text default null,
  p_actor text default null,
  p_entitlement_days integer default null,
  p_hold_seconds integer default 1800
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_wallet_id uuid; v_tx_id uuid; v_existing record;
  v_available bigint; v_bonus bigint; v_from_bonus bigint;
begin
  if p_owner_id is null or p_owner_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Invalid wallet owner' using errcode = 'WA400';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Reserve amount must be positive' using errcode = 'WA400'; end if;
  if p_external_id is null or length(p_external_id) < 8 then
    raise exception 'Reserve requires an external_id (idempotency key)' using errcode = 'WA400';
  end if;
  if p_hold_seconds is null or p_hold_seconds not between 60 and 86400 then
    raise exception 'Hold must be between 60 and 86400 seconds' using errcode = 'WA400';
  end if;
  if p_entitlement_days is not null and p_entitlement_days not between 1 and 3660 then
    raise exception 'entitlement_days out of range' using errcode = 'WA400';
  end if;

  v_wallet_id := get_or_create_wallet(p_owner_id);
  -- Serialise every balance-reducing write on this wallet.
  perform 1 from wallets where id = v_wallet_id for update;

  -- Idempotent replay: same key must mean the same owner, product and amount.
  select lt.id, lt.kind, lt.product_key into v_existing from ledger_transactions lt where lt.external_id = p_external_id;
  if found then
    if v_existing.kind = 'reserve'
       and v_existing.product_key is not distinct from p_product_key
       and (select coalesce(sum(e.amount), 0) from ledger_entries e
             where e.transaction_id = v_existing.id and e.wallet_id = v_wallet_id and e.bucket = 'reserved') = p_amount
    then
      return v_existing.id;
    end if;
    raise exception 'Idempotency key already used for a different request' using errcode = 'WA409';
  end if;

  -- Lazily free this wallet's expired holds before checking the balance.
  perform release_hold_internal(t.id, 'Hold expired', 'system:expiry')
    from ledger_transactions t
   where t.kind = 'reserve' and t.hold_expires_at < now()
     and exists (select 1 from ledger_entries e where e.transaction_id = t.id and e.wallet_id = v_wallet_id)
     and not exists (select 1 from ledger_transactions s where s.settles_reservation_id = t.id)
     and not exists (select 1 from ledger_transactions s  -- legacy settlement (no link column)
                      where s.external_id in (t.external_id || ':release', t.external_id || ':capture')
                        and s.kind in ('release', 'spend'));

  select coalesce(sum(amount) filter (where bucket in ('paid','bonus')), 0),
         coalesce(sum(amount) filter (where bucket = 'bonus'), 0)
    into v_available, v_bonus
    from ledger_entries where wallet_id = v_wallet_id;
  if v_available < p_amount then
    raise exception 'Insufficient balance: % available, % requested', v_available, p_amount using errcode = 'WA402';
  end if;

  begin
    insert into ledger_transactions (external_id, kind, description, app_slug, product_key, actor, hold_expires_at, entitlement_days)
    values (p_external_id, 'reserve', p_description, p_app_slug, p_product_key, p_actor,
            now() + make_interval(secs => p_hold_seconds), p_entitlement_days)
    returning id into v_tx_id;
  exception when unique_violation then
    raise exception 'Idempotency key already used for a different request' using errcode = 'WA409';
  end;

  -- Bonus first, then paid.
  v_from_bonus := least(greatest(v_bonus, 0), p_amount);
  if v_from_bonus > 0 then
    insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'bonus', -v_from_bonus);
  end if;
  if p_amount - v_from_bonus > 0 then
    insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'paid', -(p_amount - v_from_bonus));
  end if;
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'reserved', p_amount);
  return v_tx_id;
end $$;

-- ---------------------------------------------------------------- capture (legacy settlement aware)
create or replace function public.capture_xp(
  p_reservation_id uuid,
  p_description text default 'Redemption captured',
  p_actor text default null,
  p_allowed_apps text[] default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_res record; v_tx_id uuid; v_kind text;
  v_wallet_id uuid; v_owner_id uuid; v_clearing_id uuid; v_amount bigint;
begin
  select id, app_slug, external_id, product_key, entitlement_days into v_res
    from ledger_transactions where id = p_reservation_id and kind = 'reserve' for update;
  if not found or (p_allowed_apps is not null and not coalesce(v_res.app_slug = any (p_allowed_apps), false)) then
    raise exception 'Reservation % not found', p_reservation_id using errcode = 'WA404';
  end if;

  select id, kind into v_tx_id, v_kind from ledger_transactions where settles_reservation_id = p_reservation_id;
  if v_tx_id is null and v_res.external_id is not null then
    select id, kind into v_tx_id, v_kind from ledger_transactions
     where external_id in (v_res.external_id || ':release', v_res.external_id || ':capture')
       and kind in ('release', 'spend')
     order by (kind = 'spend') desc
     limit 1;
  end if;
  if v_tx_id is not null then
    if v_kind = 'spend' then return v_tx_id; end if;
    raise exception 'Reservation % was already released', p_reservation_id using errcode = 'WA409';
  end if;

  select wallet_id, sum(amount) into v_wallet_id, v_amount
    from ledger_entries where transaction_id = p_reservation_id and bucket = 'reserved' group by wallet_id;
  if v_wallet_id is null or v_amount <= 0 then
    raise exception 'No reserved Ixis found for reservation %', p_reservation_id using errcode = 'WA404';
  end if;
  select owner_id into v_owner_id from wallets where id = v_wallet_id;
  v_clearing_id := get_or_create_wallet('00000000-0000-0000-0000-000000000000'::uuid);

  begin
    insert into ledger_transactions (kind, description, app_slug, external_id, settles_reservation_id, product_key, actor)
    values ('spend', p_description, v_res.app_slug, v_res.external_id || ':capture', p_reservation_id, v_res.product_key, p_actor)
    returning id into v_tx_id;
  exception when unique_violation then
    raise exception 'Reservation % already has a settlement row', p_reservation_id using errcode = 'WA409';
  end;
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'reserved', -v_amount);
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_clearing_id, 'clearing', v_amount);

  if v_res.product_key is not null then
    insert into entitlements (owner_id, app_slug, product_key, status, xp_price, renews_at, updated_at, source_transaction_id)
    values (
      v_owner_id, coalesce(v_res.app_slug, 'wallet'), v_res.product_key, 'active', v_amount,
      case when v_res.entitlement_days is null then null else now() + make_interval(days => v_res.entitlement_days) end,
      now(), v_tx_id
    )
    on conflict (owner_id, app_slug, product_key) do update set
      status = 'active',
      xp_price = excluded.xp_price,
      updated_at = now(),
      source_transaction_id = excluded.source_transaction_id,
      renews_at = case
        when v_res.entitlement_days is null then null
        else greatest(coalesce(entitlements.renews_at, now()), now()) + make_interval(days => v_res.entitlement_days)
      end;
  end if;
  return v_tx_id;
end $$;

-- ---------------------------------------------------------------- expiry sweep (cron): idempotent, never all-or-nothing
create or replace function public.release_expired_holds(p_limit integer default 500)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; v_count integer := 0;
begin
  for r in
    select t.id from ledger_transactions t
     where t.kind = 'reserve' and t.hold_expires_at < now()
       and not exists (select 1 from ledger_transactions s where s.settles_reservation_id = t.id)
       and not exists (select 1 from ledger_transactions s
                        where s.external_id in (t.external_id || ':release', t.external_id || ':capture')
                          and s.kind in ('release', 'spend'))
     order by t.hold_expires_at
     limit greatest(least(p_limit, 5000), 1)
  loop
    begin
      perform release_hold_internal(r.id, 'Hold expired', 'system:expiry');
      v_count := v_count + 1;
    exception
      when sqlstate 'WA409' or sqlstate 'WA404' then
        null; -- settled concurrently / nothing held
      when unique_violation then
        raise warning 'release_expired_holds: skipped reservation % (%)', r.id, sqlerrm;
    end;
  end loop;
  return v_count;
end $$;

-- Same lock-down as 007 (create or replace keeps grants; restated so a fresh database matches).
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('release_hold_internal', 'reserve_xp', 'capture_xp', 'release_expired_holds')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
