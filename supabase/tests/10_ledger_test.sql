-- Ledger behaviour tests. Run by scripts/test-sql.sh on a fresh database after 00_supabase_stub.sql
-- and every migration. Each block raises (and fails the run) on the first broken expectation.
\set ON_ERROR_STOP 1

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'alice@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'bob@example.com')
on conflict do nothing;

create or replace function pg_temp.bal(p_owner uuid, out available bigint, out reserved bigint, out paid bigint, out bonus bigint)
language sql as $$
  select available_xp, reserved_xp, paid_xp, bonus_xp from public.wallet_balances where owner_id = p_owner
$$;

create or replace function pg_temp.expect_error(p_sql text, p_state text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected SQLSTATE % from: %', p_state, p_sql;
exception when others then
  if sqlstate <> p_state then raise exception 'expected SQLSTATE %, got % (%) from: %', p_state, sqlstate, sqlerrm, p_sql; end if;
end $$;

-- 1. Only service_role may execute the money functions -----------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in (
       'get_or_create_wallet','credit_xp','refund_xp','reserve_xp','capture_xp','release_xp',
       'release_hold_internal','release_expired_holds','wallet_history','find_user_id_by_email')
  loop
    if has_function_privilege('anon', r.f, 'execute') or has_function_privilege('authenticated', r.f, 'execute') then
      raise exception 'SECURITY: % is executable by anon/authenticated', r.f;
    end if;
    if not has_function_privilege('service_role', r.f, 'execute') then
      raise exception '% is not executable by service_role', r.f;
    end if;
  end loop;
end $$;

set role anon;
select pg_temp.expect_error($q$select public.credit_xp('11111111-1111-4111-8111-111111111111', 1000, 'paid', 'mint')$q$, '42501');
reset role;
set role authenticated;
select pg_temp.expect_error($q$select public.credit_xp('11111111-1111-4111-8111-111111111111', 1000, 'paid', 'mint')$q$, '42501');
select pg_temp.expect_error($q$insert into public.ledger_entries (transaction_id, wallet_id, bucket, amount) values (gen_random_uuid(), gen_random_uuid(), 'paid', 1)$q$, '42501');
reset role;

-- 2. Credit is idempotent on the Stripe event id -------------------------------------------------
do $$
declare a uuid; b uuid; v record;
begin
  a := public.credit_xp('11111111-1111-4111-8111-111111111111', 50000, 'paid', 'Studio pack', 'evt_credit_1');
  b := public.credit_xp('11111111-1111-4111-8111-111111111111', 50000, 'paid', 'Studio pack', 'evt_credit_1');
  if a <> b then raise exception 'duplicate webhook created a second credit'; end if;
  select * into v from pg_temp.bal('11111111-1111-4111-8111-111111111111');
  if v.available <> 50000 or v.paid <> 50000 then raise exception 'credit balance wrong: %', v; end if;
end $$;

-- 3. Stripe refund reverses the purchase (does NOT add Ixis) ------------------------------------
do $$
declare v record; a uuid; b uuid;
begin
  a := public.refund_xp('11111111-1111-4111-8111-111111111111', 10000, 'Refund · ch_1', 'evt_refund_1');
  b := public.refund_xp('11111111-1111-4111-8111-111111111111', 10000, 'Refund · ch_1', 'evt_refund_1');
  if a <> b then raise exception 'duplicate refund applied twice'; end if;
  select * into v from pg_temp.bal('11111111-1111-4111-8111-111111111111');
  if v.available <> 40000 then raise exception 'refund should leave 40000, got %', v.available; end if;
end $$;

-- 4. Reserve → capture grants an entitlement; replay is idempotent -------------------------------
do $$
declare r uuid; r2 uuid; c uuid; c2 uuid; v record; e record;
begin
  r := public.reserve_xp('11111111-1111-4111-8111-111111111111', 5000, 'Renoxis Monthly', 'renoxis:seat-2026-09',
                         'renoxis', 'renoxis.agent.monthly', 'test', 30);
  r2 := public.reserve_xp('11111111-1111-4111-8111-111111111111', 5000, 'Renoxis Monthly', 'renoxis:seat-2026-09',
                          'renoxis', 'renoxis.agent.monthly', 'test', 30);
  if r <> r2 then raise exception 'reserve replay returned a different hold'; end if;
  select * into v from pg_temp.bal('11111111-1111-4111-8111-111111111111');
  if v.available <> 35000 or v.reserved <> 5000 then raise exception 'hold balance wrong: %', v; end if;

  c := public.capture_xp(r);
  c2 := public.capture_xp(r);
  if c <> c2 then raise exception 'capture not idempotent'; end if;
  select * into v from pg_temp.bal('11111111-1111-4111-8111-111111111111');
  if v.available <> 35000 or v.reserved <> 0 then raise exception 'captured balance wrong: %', v; end if;

  select * into e from public.entitlements where owner_id = '11111111-1111-4111-8111-111111111111' and product_key = 'renoxis.agent.monthly';
  if e.status <> 'active' or e.renews_at is null or e.renews_at < now() + interval '29 days' then
    raise exception 'monthly seat must get a ~30 day renews_at, got %', e.renews_at;
  end if;

  -- renewing while active stacks another 30 days
  r := public.reserve_xp('11111111-1111-4111-8111-111111111111', 5000, 'Renoxis Monthly', 'renoxis:seat-2026-10',
                         'renoxis', 'renoxis.agent.monthly', 'test', 30);
  perform public.capture_xp(r);
  select * into e from public.entitlements where owner_id = '11111111-1111-4111-8111-111111111111' and product_key = 'renoxis.agent.monthly';
  if e.renews_at < now() + interval '59 days' then raise exception 'renewal should stack, got %', e.renews_at; end if;
end $$;

-- 5. Same idempotency key for a different owner/product/amount is a conflict --------------------
select pg_temp.expect_error($q$select public.reserve_xp('22222222-2222-4222-8222-222222222222', 5000, 'x', 'renoxis:seat-2026-09', 'renoxis', 'renoxis.agent.monthly')$q$, 'WA409');
select pg_temp.expect_error($q$select public.reserve_xp('11111111-1111-4111-8111-111111111111', 1000, 'x', 'renoxis:seat-2026-09', 'renoxis', 'renoxis.agent.monthly')$q$, 'WA409');
select pg_temp.expect_error($q$select public.reserve_xp('11111111-1111-4111-8111-111111111111', 5000, 'x', 'renoxis:seat-2026-09', 'renoxis', 'renoxis.activate')$q$, 'WA409');
-- a Stripe event id used as a reserve key must not return the purchase
select pg_temp.expect_error($q$select public.reserve_xp('11111111-1111-4111-8111-111111111111', 100, 'x', 'evt_credit_1', 'renoxis', 'renoxis.activate')$q$, 'WA409');

-- 6. Release after capture is refused; capture after release is refused --------------------------
do $$
declare r uuid; v record;
begin
  r := public.reserve_xp('11111111-1111-4111-8111-111111111111', 1000, 'File', 'renoxis:file-1', 'renoxis', 'renoxis.file.listing');
  perform public.capture_xp(r);
  perform pg_temp.expect_error(format('select public.release_xp(%L)', r), 'WA409');

  r := public.reserve_xp('11111111-1111-4111-8111-111111111111', 1000, 'File', 'renoxis:file-2', 'renoxis', 'renoxis.file.offer');
  perform public.release_xp(r);
  perform public.release_xp(r); -- idempotent
  perform pg_temp.expect_error(format('select public.capture_xp(%L)', r), 'WA409');
  if exists (select 1 from public.entitlements where product_key = 'renoxis.file.offer') then
    raise exception 'released hold must not grant';
  end if;
  select * into v from pg_temp.bal('11111111-1111-4111-8111-111111111111');
  if v.available <> 29000 or v.reserved <> 0 then raise exception 'after capture+release expected 29000/0, got %', v; end if;
end $$;

-- 7. App scoping: a key for one app cannot settle another app's hold -----------------------------
do $$
declare r uuid;
begin
  r := public.reserve_xp('11111111-1111-4111-8111-111111111111', 1000, 'Skin', 'socixis:skin-1', 'socixis', 'socixis.avatar.skin.anime');
  perform pg_temp.expect_error(format('select public.capture_xp(%L, %L, %L, %L::text[])', r, 'x', 'renoxis-key', '{renoxis}'), 'WA404');
  perform pg_temp.expect_error(format('select public.release_xp(%L, %L, %L, %L::text[])', r, 'x', 'renoxis-key', '{renoxis}'), 'WA404');
  perform public.capture_xp(r, 'ok', 'socixis-key', '{socixis}');
end $$;

-- 8. Insufficient balance, bonus-first spend, and bonus returns to bonus on release --------------
do $$
declare r uuid; v record;
begin
  perform pg_temp.expect_error($q$select public.reserve_xp('22222222-2222-4222-8222-222222222222', 1, 'x', 'bobkey-0001')$q$, 'WA402');
  perform public.credit_xp('22222222-2222-4222-8222-222222222222', 3000, 'paid', 'Spark pack', 'evt_bob_paid');
  perform public.credit_xp('22222222-2222-4222-8222-222222222222', 500, 'bonus', 'Welcome bonus', 'evt_bob_bonus');
  r := public.reserve_xp('22222222-2222-4222-8222-222222222222', 1000, 'x', 'bobkey-0002');
  select * into v from pg_temp.bal('22222222-2222-4222-8222-222222222222');
  if v.bonus <> 0 or v.paid <> 2500 then raise exception 'bonus should be spent first: %', v; end if;
  perform public.release_xp(r);
  select * into v from pg_temp.bal('22222222-2222-4222-8222-222222222222');
  if v.bonus <> 500 or v.paid <> 3000 then raise exception 'release must restore origin buckets: %', v; end if;
  perform pg_temp.expect_error($q$select public.reserve_xp('22222222-2222-4222-8222-222222222222', 3501, 'x', 'bobkey-0003')$q$, 'WA402');
end $$;

-- 9. Expired holds are released (lazily on next reserve, and by the sweep) ----------------------
do $$
declare r uuid; v record; n int;
begin
  r := public.reserve_xp('22222222-2222-4222-8222-222222222222', 3000, 'x', 'bobkey-0004', null, null, null, null, 60);
  select * into v from pg_temp.bal('22222222-2222-4222-8222-222222222222');
  if v.reserved <> 3000 then raise exception 'hold missing: %', v; end if;
  -- time travel: the ledger is append-only, so backdate via a session that bypasses triggers
  set local session_replication_role = replica;
  update public.ledger_transactions set hold_expires_at = now() - interval '1 minute' where id = r;
  set local session_replication_role = origin;
  -- the next reserve frees it first, so 3,500 fits again
  perform public.reserve_xp('22222222-2222-4222-8222-222222222222', 3500, 'x', 'bobkey-0005');
  select * into v from pg_temp.bal('22222222-2222-4222-8222-222222222222');
  if v.reserved <> 3500 or v.available <> 0 then raise exception 'lazy expiry failed: %', v; end if;
  n := public.release_expired_holds();
  if n <> 0 then raise exception 'nothing else should be expired, released %', n; end if;
end $$;

-- 10. Ledger is append-only and every transaction balances --------------------------------------
select pg_temp.expect_error($q$update public.ledger_entries set amount = amount + 1$q$, 'WA403');
select pg_temp.expect_error($q$delete from public.ledger_transactions$q$, 'WA403');
do $$
begin
  if exists (select transaction_id from public.ledger_entries group by transaction_id having sum(amount) <> 0) then
    raise exception 'an unbalanced transaction exists';
  end if;
end $$;
begin;
set constraints all immediate;
select pg_temp.expect_error($q$
  with t as (insert into public.ledger_transactions (kind, description) values ('adjustment', 'bad') returning id)
  insert into public.ledger_entries (transaction_id, wallet_id, bucket, amount)
  select t.id, (select id from public.wallets where owner_id = '11111111-1111-4111-8111-111111111111'), 'paid', 999 from t
$q$, 'WA500');
commit;

-- 11. History: one row per transaction with net effect ------------------------------------------
do $$
declare n bigint; total bigint;
begin
  select count(*), max(total_count) into n, total from public.wallet_history('11111111-1111-4111-8111-111111111111', 100, 0);
  if n = 0 or n <> total then raise exception 'history rows % vs total %', n, total; end if;
  if exists (select 1 from public.wallet_history('11111111-1111-4111-8111-111111111111', 100, 0) where kind = 'reserve' and available_delta >= 0) then
    raise exception 'a hold must show a negative available delta';
  end if;
end $$;

-- 12. The clearing wallet can never be a customer ----------------------------------------------
select pg_temp.expect_error($q$select public.reserve_xp('00000000-0000-0000-0000-000000000000', 1, 'x', 'clearing-1')$q$, 'WA400');

\echo 'ledger tests: ok'
