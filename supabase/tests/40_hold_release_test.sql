-- 2026-09-28 Grok Developer Bot: release-holds sweep must be idempotent and must not trip over reserves
-- that were settled by the pre-003 functions (settlement row has the derived external_id but no
-- settles_reservation_id). Reproduces the 2026-09-27 cron 500 (ledger_transactions_external_id_key).
\set ON_ERROR_STOP 1

insert into auth.users (id, email) values ('44444444-4444-4444-8444-444444444444', 'legacy@example.com')
on conflict do nothing;

create or replace function pg_temp.expect_error4(p_sql text, p_state text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected SQLSTATE % from: %', p_state, p_sql;
exception when others then
  if sqlstate <> p_state then raise exception 'expected SQLSTATE %, got % (%) from: %', p_state, sqlstate, sqlerrm, p_sql; end if;
end $$;

-- Legacy fixtures: one released hold, one captured hold (both unlinked), one genuinely open expired hold.
do $$
declare
  o uuid := '44444444-4444-4444-8444-444444444444';
  w uuid; c uuid; r1 uuid; r2 uuid; r3 uuid; s uuid;
begin
  perform public.credit_xp(o, 10000, 'paid', 'Legacy pack', 'evt_legacy_pack');
  w := public.get_or_create_wallet(o);
  c := public.get_or_create_wallet('00000000-0000-0000-0000-000000000000'::uuid);

  insert into public.ledger_transactions (external_id, kind, description, app_slug, hold_expires_at)
  values ('legacy_rsv_1', 'reserve', 'legacy hold 1', 'socixis', now() - interval '4 days') returning id into r1;
  insert into public.ledger_entries (transaction_id, wallet_id, bucket, amount) values (r1, w, 'paid', -1000), (r1, w, 'reserved', 1000);
  insert into public.ledger_transactions (external_id, kind, description, app_slug)
  values ('legacy_rsv_1:release', 'release', 'Reservation released [res:' || r1 || ']', 'socixis') returning id into s;
  insert into public.ledger_entries (transaction_id, wallet_id, bucket, amount) values (s, w, 'reserved', -1000), (s, w, 'paid', 1000);

  insert into public.ledger_transactions (external_id, kind, description, app_slug, hold_expires_at)
  values ('legacy_rsv_2', 'reserve', 'legacy hold 2', 'contentbot', now() - interval '4 days') returning id into r2;
  insert into public.ledger_entries (transaction_id, wallet_id, bucket, amount) values (r2, w, 'paid', -800), (r2, w, 'reserved', 800);
  insert into public.ledger_transactions (external_id, kind, description, app_slug)
  values ('legacy_rsv_2:capture', 'spend', 'Redemption captured [res:' || r2 || ']', 'contentbot') returning id into s;
  insert into public.ledger_entries (transaction_id, wallet_id, bucket, amount) values (s, w, 'reserved', -800), (s, c, 'clearing', 800);

  insert into public.ledger_transactions (external_id, kind, description, app_slug, hold_expires_at)
  values ('legacy_rsv_3', 'reserve', 'open hold', 'renoxis', now() - interval '4 days') returning id into r3;
  insert into public.ledger_entries (transaction_id, wallet_id, bucket, amount) values (r3, w, 'paid', -500), (r3, w, 'reserved', 500);
end $$;

-- The sweep releases only the genuinely open hold, twice in a row without error.
do $$
declare n int; v record;
begin
  n := public.release_expired_holds(1000);
  if n <> 1 then raise exception 'sweep released % holds, expected 1', n; end if;
  n := public.release_expired_holds(1000);
  if n <> 0 then raise exception 'second sweep released % holds, expected 0 (not idempotent)', n; end if;
  select available_xp, reserved_xp into v from public.wallet_balances where owner_id = '44444444-4444-4444-8444-444444444444';
  -- 10000 credited, 800 captured (legacy), everything else back in paid; nothing left reserved.
  if v.available_xp <> 9200 or v.reserved_xp <> 0 then raise exception 'legacy sweep balance wrong: %', v; end if;
  if (select count(*) from public.ledger_transactions where external_id = 'legacy_rsv_2:release') <> 0 then
    raise exception 'captured legacy hold was released (double credit)';
  end if;
end $$;

-- Direct calls on legacy-settled holds are idempotent / conflict, never a duplicate-key error.
do $$
declare r1 uuid; r2 uuid; got uuid;
begin
  select id into r1 from public.ledger_transactions where external_id = 'legacy_rsv_1';
  select id into r2 from public.ledger_transactions where external_id = 'legacy_rsv_2';
  got := public.release_xp(r1);
  if got <> (select id from public.ledger_transactions where external_id = 'legacy_rsv_1:release') then
    raise exception 'release of a legacy-released hold did not return the legacy release';
  end if;
  got := public.capture_xp(r2);
  if got <> (select id from public.ledger_transactions where external_id = 'legacy_rsv_2:capture') then
    raise exception 'capture of a legacy-captured hold did not return the legacy capture';
  end if;
end $$;
select pg_temp.expect_error4(format('select public.release_xp(%L)', (select id from public.ledger_transactions where external_id = 'legacy_rsv_2')), 'WA409');
select pg_temp.expect_error4(format('select public.capture_xp(%L)', (select id from public.ledger_transactions where external_id = 'legacy_rsv_1')), 'WA409');

-- The owner's next reserve (lazy expiry path) works.
do $$
declare id uuid; v record;
begin
  id := public.reserve_xp('44444444-4444-4444-8444-444444444444', 100, 'after legacy', 'after-legacy-1');
  select available_xp, reserved_xp into v from public.wallet_balances where owner_id = '44444444-4444-4444-8444-444444444444';
  if v.available_xp <> 9100 or v.reserved_xp <> 100 then raise exception 'reserve after legacy wrong: %', v; end if;
end $$;

-- Still service_role only.
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('release_hold_internal','reserve_xp','capture_xp','release_expired_holds')
  loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'SECURITY: % is executable by anon/authenticated', f;
    end if;
  end loop;
end $$;

\echo 'hold release tests: ok'
