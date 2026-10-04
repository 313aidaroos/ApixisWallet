-- 2026-10-04 Grok (Wallet executor): migration 013 — Apixis ID welcome grant + bonus-safe marketplace payouts.
\set ON_ERROR_STOP 1

create or replace function pg_temp.expect_error5(p_sql text, p_state text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected SQLSTATE % from: %', p_state, p_sql;
exception when others then
  if sqlstate <> p_state then raise exception 'expected SQLSTATE %, got % (%) from: %', p_state, sqlstate, sqlerrm, p_sql; end if;
end $$;

insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values
  ('55555555-5555-4555-8555-000000000001', 'unconfirmed@example.com', null, now()),
  ('55555555-5555-4555-8555-000000000002', 'never-signed-in@example.com', now(), null),
  ('55555555-5555-4555-8555-000000000003', 'grant@example.com', now(), now()),
  ('55555555-5555-4555-8555-000000000004', 'GRANT@Example.com', now(), now()),   -- same address, other id
  ('55555555-5555-4555-8555-000000000005', 'spender@example.com', now(), now()),
  ('55555555-5555-4555-8555-000000000006', 'buyer-paid@example.com', now(), now()),
  ('55555555-5555-4555-8555-000000000007', 'buyer-bonus@example.com', now(), now()),
  ('55555555-5555-4555-8555-000000000008', 'buyer-mixed@example.com', now(), now()),
  ('55555555-5555-4555-8555-000000000009', 'seller@example.com', now(), now())
on conflict do nothing;

-- ---------------------------------------------------------------- privileges
do $$
declare f text;
begin
  foreach f in array array[
    'public.grant_signup_xp(uuid,text,text,text,text)',
    'public.revoke_signup_grant(uuid,text,text)',
    'public.settle_marketplace_payout(uuid,uuid,bigint,text,text,text,text)'] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception '% is executable by anon/authenticated', f;
    end if;
    if not has_function_privilege('service_role', f, 'execute') then raise exception '% not executable by service_role', f; end if;
  end loop;
  if has_table_privilege('anon', 'public.signup_grants', 'select') or has_table_privilege('authenticated', 'public.signup_grants', 'select')
     or has_table_privilege('authenticated', 'public.signup_grants', 'insert') then
    raise exception 'signup_grants readable/writable by anon/authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------- eligibility
do $$
declare r jsonb;
begin
  r := public.grant_signup_xp('55555555-5555-4555-8555-000000000001', 'test');
  if r->>'reason' <> 'email_not_confirmed' or (r->>'granted')::boolean then raise exception 'unconfirmed: %', r; end if;
  r := public.grant_signup_xp('55555555-5555-4555-8555-000000000002', 'test');
  if r->>'reason' <> 'no_sign_in' then raise exception 'never signed in: %', r; end if;
  r := public.grant_signup_xp('55555555-5555-4555-8555-0000000000ff', 'test');
  if r->>'reason' <> 'no_user' then raise exception 'unknown user: %', r; end if;
  if exists (select 1 from public.ledger_transactions
              where external_id in ('signup_grant:55555555-5555-4555-8555-000000000001', 'signup_grant:55555555-5555-4555-8555-000000000002'))
     or exists (select 1 from public.signup_grants where owner_id in ('55555555-5555-4555-8555-000000000001', '55555555-5555-4555-8555-000000000002')) then
    raise exception 'ineligible user got a ledger row';
  end if;
end $$;
select pg_temp.expect_error5($q$select public.grant_signup_xp('00000000-0000-0000-0000-000000000000', 'test')$q$, 'WA400');

-- ---------------------------------------------------------------- the grant: 1,000 bonus, once, audited, balanced
do $$
declare r jsonb; r2 jsonb; v record; c_before bigint; c_after bigint; g record;
begin
  select coalesce(sum(e.amount), 0) into c_before from public.ledger_entries e join public.wallets w on w.id = e.wallet_id
   where w.owner_id = '00000000-0000-0000-0000-000000000000';
  r := public.grant_signup_xp('55555555-5555-4555-8555-000000000003', 'auth_callback', 'test', '203.0.113.9', 'ua');
  if not (r->>'granted')::boolean or (r->>'amount')::bigint <> 1000 then raise exception 'grant failed: %', r; end if;
  select * into v from public.wallet_balances where owner_id = '55555555-5555-4555-8555-000000000003';
  if v.available_xp <> 1000 or v.bonus_xp <> 1000 or v.paid_xp <> 0 then raise exception 'grant balance wrong: %', v; end if;
  select coalesce(sum(e.amount), 0) into c_after from public.ledger_entries e join public.wallets w on w.id = e.wallet_id
   where w.owner_id = '00000000-0000-0000-0000-000000000000';
  if c_after - c_before <> -1000 then raise exception 'clearing moved by %, expected -1000', c_after - c_before; end if;
  if (select kind from public.ledger_transactions where id = (r->>'transaction_id')::uuid) <> 'bonus'
     or (select app_slug from public.ledger_transactions where id = (r->>'transaction_id')::uuid) <> 'wallet'
     or (select external_id from public.ledger_transactions where id = (r->>'transaction_id')::uuid) <> 'signup_grant:55555555-5555-4555-8555-000000000003' then
    raise exception 'grant ledger row has the wrong kind/app/external_id';
  end if;
  select * into g from public.signup_grants where owner_id = '55555555-5555-4555-8555-000000000003';
  if g.amount <> 1000 or g.source <> 'auth_callback' or g.email <> 'grant@example.com' then raise exception 'grants row wrong: %', g; end if;
  if (select count(*) from public.audit_events where event_type = 'signup_grant' and owner_id = '55555555-5555-4555-8555-000000000003'
        and amount_ixis = 1000 and ip_address = '203.0.113.9' and (details->>'fee_ixis')::int = 0) <> 1 then
    raise exception 'grant audit row missing';
  end if;

  r2 := public.grant_signup_xp('55555555-5555-4555-8555-000000000003', 'sso_token');
  if (r2->>'granted')::boolean or r2->>'reason' <> 'already_granted' then raise exception 'second grant: %', r2; end if;
  r2 := public.grant_signup_xp('55555555-5555-4555-8555-000000000004', 'password_login');
  if (r2->>'granted')::boolean or r2->>'reason' <> 'email_already_granted' then raise exception 'same email, other id: %', r2; end if;
  select * into v from public.wallet_balances where owner_id = '55555555-5555-4555-8555-000000000003';
  if v.available_xp <> 1000 then raise exception 'replay changed the balance: %', v; end if;
end $$;

-- ---------------------------------------------------------------- mint ceiling (rolled back)
do $$
begin
  begin
    perform public.credit_xp('55555555-5555-4555-8555-000000000005', 999999999999, 'paid', 'cap fill', 'evt_cap_fill');
    perform public.grant_signup_xp('55555555-5555-4555-8555-000000000005', 'test');
    raise exception 'grant above IXIS_MAX_SUPPLY was allowed';
  exception when sqlstate 'WA409' then
    null;  -- refused, and the subtransaction (cap fill included) is rolled back
  end;
  if exists (select 1 from public.signup_grants where owner_id = '55555555-5555-4555-8555-000000000005') then
    raise exception 'cap-refused grant left a grants row';
  end if;
end $$;

-- ---------------------------------------------------------------- spend first, refunds don't touch it, claw-back
do $$
declare o uuid := '55555555-5555-4555-8555-000000000005'; r jsonb; rsv uuid; v record;
begin
  perform public.grant_signup_xp(o, 'test');
  perform public.credit_xp(o, 2000, 'paid', 'pack', 'evt_spender_pack');
  rsv := public.reserve_xp(o, 600, 'redeem', 'spender-redeem-1', 'renoxis');
  perform public.capture_xp(rsv, 'captured', null, null);
  select * into v from public.wallet_balances where owner_id = o;
  if v.bonus_xp <> 400 or v.paid_xp <> 2000 then raise exception 'bonus not spent first: %', v; end if;
  perform public.refund_xp(o, 2000, 'stripe refund', 'evt_spender_refund');
  select * into v from public.wallet_balances where owner_id = o;
  if v.bonus_xp <> 400 or v.paid_xp <> 0 then raise exception 'refund touched the grant: %', v; end if;

  r := public.revoke_signup_grant(o, 'bot signup', 'test');
  if not (r->>'revoked')::boolean or (r->>'clawed_back')::bigint <> 400 then raise exception 'revoke: %', r; end if;
  select * into v from public.wallet_balances where owner_id = o;
  if v.bonus_xp <> 0 then raise exception 'revoke left bonus: %', v; end if;
  r := public.revoke_signup_grant(o, 'bot signup', 'test');
  if (r->>'revoked')::boolean or r->>'reason' <> 'already_revoked' then raise exception 'second revoke: %', r; end if;
  if (select count(*) from public.audit_events where event_type = 'signup_grant_revoke' and owner_id = o) <> 1 then
    raise exception 'revoke audit row missing';
  end if;
  -- One grant per Apixis ID, even after a claw-back.
  r := public.grant_signup_xp(o, 'test');
  if r->>'reason' <> 'already_granted' then raise exception 'regrant after revoke: %', r; end if;
end $$;
select pg_temp.expect_error5($q$select public.revoke_signup_grant('55555555-5555-4555-8555-000000000009', 'nope')$q$, 'WA404');
select pg_temp.expect_error5($q$select public.revoke_signup_grant('55555555-5555-4555-8555-000000000003', '')$q$, 'WA400');

-- ---------------------------------------------------------------- marketplace payouts keep bonus as bonus
do $$
declare
  s uuid := '55555555-5555-4555-8555-000000000009';
  bp uuid := '55555555-5555-4555-8555-000000000006';
  bb uuid := '55555555-5555-4555-8555-000000000007';
  bm uuid := '55555555-5555-4555-8555-000000000008';
  rsv uuid; r jsonb; r2 jsonb; v record; c_before bigint; c_after bigint;
begin
  -- a) all-paid hold → all-paid payout (behaviour unchanged)
  perform public.credit_xp(bp, 10000, 'paid', 'pack', 'evt_buyer_paid');
  rsv := public.reserve_xp(bp, 1000, 'order', 'mkt-paid-0001', 'ominix', null, null, null, 86400);
  perform public.capture_xp(rsv, 'settled', null, null);
  r := public.settle_marketplace_payout(rsv, s, 950, 'payout', 'mkt-paid-0001:payout', 'ominix');
  if (r->>'paid')::bigint <> 950 or (r->>'bonus')::bigint <> 0 then raise exception 'paid hold payout: %', r; end if;

  -- b) all-bonus hold (the welcome grant) → all-bonus payout
  perform public.grant_signup_xp(bb, 'test');
  rsv := public.reserve_xp(bb, 1000, 'order', 'mkt-bonus-0001', 'ominix', null, null, null, 86400);
  perform public.capture_xp(rsv, 'settled', null, null);
  r := public.settle_marketplace_payout(rsv, s, 950, 'payout', 'mkt-bonus-0001:payout', 'ominix');
  if (r->>'paid')::bigint <> 0 or (r->>'bonus')::bigint <> 950 then raise exception 'bonus hold payout: %', r; end if;
  if (select kind from public.ledger_transactions where id = (r->>'transaction_id')::uuid) <> 'bonus' then
    raise exception 'all-bonus payout should be kind bonus';
  end if;

  -- c) mixed hold: 300 bonus + 700 paid → payout 950 = floor(950×700/1000)=665 paid + 285 bonus
  perform public.credit_xp(bm, 300, 'bonus', 'promo', 'promo-mixed-buyer');
  perform public.credit_xp(bm, 5000, 'paid', 'pack', 'evt_buyer_mixed');
  rsv := public.reserve_xp(bm, 1000, 'order', 'mkt-mixed-0001', 'ominix', null, null, null, 86400);
  perform public.capture_xp(rsv, 'settled', null, null);
  select coalesce(sum(e.amount), 0) into c_before from public.ledger_entries e join public.wallets w on w.id = e.wallet_id
   where w.owner_id = '00000000-0000-0000-0000-000000000000';
  r := public.settle_marketplace_payout(rsv, s, 950, 'payout', 'mkt-mixed-0001:payout', 'ominix');
  if (r->>'paid')::bigint <> 665 or (r->>'bonus')::bigint <> 285 or (r->>'held_from_bonus')::bigint <> 300 then
    raise exception 'mixed hold payout: %', r;
  end if;
  select coalesce(sum(e.amount), 0) into c_after from public.ledger_entries e join public.wallets w on w.id = e.wallet_id
   where w.owner_id = '00000000-0000-0000-0000-000000000000';
  if c_before - c_after <> 950 then raise exception 'clearing paid out %, expected 950', c_before - c_after; end if;

  -- d) rounding: 101 held = 1 bonus + 100 paid, payout 96 → paid floor(96×100/101)=95, bonus 1 (paid ≤ 100)
  rsv := public.reserve_xp(bm, 101, 'order', 'mkt-round-0001', 'ominix', null, null, null, 86400);  -- bonus is 0 now
  perform public.capture_xp(rsv, 'settled', null, null);
  r := public.settle_marketplace_payout(rsv, s, 96, 'payout', 'mkt-round-0001:payout', 'ominix');
  if (r->>'paid')::bigint <> 96 or (r->>'bonus')::bigint <> 0 then raise exception 'pure-paid small hold: %', r; end if;
  perform public.credit_xp(bm, 1, 'bonus', 'promo', 'promo-round-buyer');
  rsv := public.reserve_xp(bm, 101, 'order', 'mkt-round-0002', 'ominix', null, null, null, 86400);
  perform public.capture_xp(rsv, 'settled', null, null);
  r := public.settle_marketplace_payout(rsv, s, 96, 'payout', 'mkt-round-0002:payout', 'ominix');
  if (r->>'paid')::bigint <> 95 or (r->>'bonus')::bigint <> 1 then raise exception 'rounding payout: %', r; end if;

  -- e) replay: same key → same tx, nothing paid twice
  r2 := public.settle_marketplace_payout(rsv, s, 96, 'payout', 'mkt-round-0002:payout', 'ominix');
  if r2->>'transaction_id' <> r->>'transaction_id' or not (r2->>'replay')::boolean then raise exception 'replay: %', r2; end if;

  -- seller: 950 + 665 + 96 + 95 paid; 950 + 285 + 1 bonus
  select * into v from public.wallet_balances where owner_id = s;
  if v.paid_xp <> 1806 or v.bonus_xp <> 1236 then raise exception 'seller balance wrong: %', v; end if;
end $$;

-- f) refusals: not captured, over-payout, bad seller; a legacy (pre-013) payout row replays instead of paying again
do $$
declare bp uuid := '55555555-5555-4555-8555-000000000006'; rsv uuid; legacy uuid; r jsonb;
begin
  rsv := public.reserve_xp(bp, 500, 'order', 'mkt-open-0001', 'ominix', null, null, null, 86400);
  perform pg_temp.expect_error5(format($q$select public.settle_marketplace_payout(%L, '55555555-5555-4555-8555-000000000009', 475, 'p', 'mkt-open-0001:payout')$q$, rsv), 'WA409');
  perform public.capture_xp(rsv, 'settled', null, null);
  perform pg_temp.expect_error5(format($q$select public.settle_marketplace_payout(%L, '55555555-5555-4555-8555-000000000009', 501, 'p', 'mkt-open-0001:payout')$q$, rsv), 'WA400');
  perform pg_temp.expect_error5(format($q$select public.settle_marketplace_payout(%L, '00000000-0000-0000-0000-000000000000', 475, 'p', 'mkt-open-0001:payout')$q$, rsv), 'WA400');
  legacy := public.credit_xp('55555555-5555-4555-8555-000000000009', 475, 'paid', 'legacy payout', 'mkt-open-0001:payout', 'ominix');
  r := public.settle_marketplace_payout(rsv, '55555555-5555-4555-8555-000000000009', 475, 'p', 'mkt-open-0001:payout');
  if (r->>'transaction_id')::uuid <> legacy or not (r->>'replay')::boolean then raise exception 'legacy replay: %', r; end if;
end $$;

-- Every grant/payout transaction above is balanced (the deferred trigger enforces it); double-check the whole ledger.
do $$
begin
  if exists (select transaction_id from public.ledger_entries group by transaction_id having sum(amount) <> 0) then
    raise exception 'unbalanced transaction in ledger';
  end if;
  if exists (select 1 from public.wallet_balances where owner_id::text like '55555555%' and bonus_xp < 0) then
    raise exception 'negative bonus bucket';
  end if;
end $$;

select 'signup grant tests: ok';
