-- 2026-10-04 Grok (Wallet Lead): migration 014 — world order terms (no money moves here).
\set ON_ERROR_STOP 1

create or replace function pg_temp.expect_error6(p_sql text, p_state text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected SQLSTATE % from: %', p_state, p_sql;
exception when others then
  if sqlstate <> p_state then raise exception 'expected SQLSTATE %, got % (%) from: %', p_state, sqlstate, sqlerrm, p_sql; end if;
end $$;

insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values
  ('66666666-6666-4666-8666-000000000001', 'world-buyer@example.com', now(), now()),
  ('66666666-6666-4666-8666-000000000002', 'world-seller@example.com', now(), now())
on conflict do nothing;

do $$
begin
  if has_table_privilege('anon', 'public.marketplace_order_terms', 'select')
     or has_table_privilege('authenticated', 'public.marketplace_order_terms', 'select')
     or has_table_privilege('authenticated', 'public.marketplace_order_terms', 'insert') then
    raise exception 'marketplace_order_terms visible to anon/authenticated';
  end if;
  if not has_table_privilege('service_role', 'public.marketplace_order_terms', 'insert')
     or not has_table_privilege('service_role', 'public.marketplace_order_terms', 'select') then
    raise exception 'service_role cannot write/read marketplace_order_terms';
  end if;
  if has_table_privilege('service_role', 'public.marketplace_order_terms', 'update')
     or has_table_privilege('service_role', 'public.marketplace_order_terms', 'delete') then
    raise exception 'marketplace_order_terms must be write-once';
  end if;
end $$;

insert into public.marketplace_order_terms (external_id, kind, app_slug, buyer_id, seller_id, fee_bps)
values ('apixis:deal-0001', 'world_trade', 'apixis', '66666666-6666-4666-8666-000000000001', '66666666-6666-4666-8666-000000000002', 500),
       ('apixis:shop-0001', 'world_purchase', 'apixis', '66666666-6666-4666-8666-000000000001', null, 500);

-- a trade needs a counterparty, a purchase must not name one, nobody trades with themselves
select pg_temp.expect_error6($q$insert into public.marketplace_order_terms (external_id, kind, app_slug, buyer_id, seller_id, fee_bps)
  values ('apixis:bad-0001', 'world_trade', 'apixis', '66666666-6666-4666-8666-000000000001', null, 500)$q$, '23514');
select pg_temp.expect_error6($q$insert into public.marketplace_order_terms (external_id, kind, app_slug, buyer_id, seller_id, fee_bps)
  values ('apixis:bad-0002', 'world_purchase', 'apixis', '66666666-6666-4666-8666-000000000001', '66666666-6666-4666-8666-000000000002', 500)$q$, '23514');
select pg_temp.expect_error6($q$insert into public.marketplace_order_terms (external_id, kind, app_slug, buyer_id, seller_id, fee_bps)
  values ('apixis:bad-0003', 'world_trade', 'apixis', '66666666-6666-4666-8666-000000000001', '66666666-6666-4666-8666-000000000001', 500)$q$, '23514');
select pg_temp.expect_error6($q$insert into public.marketplace_order_terms (external_id, kind, app_slug, buyer_id, seller_id, fee_bps)
  values ('apixis:bad-0004', 'reward', 'apixis', '66666666-6666-4666-8666-000000000001', null, 500)$q$, '23514');
-- same key twice is refused by the primary key (the route compares and answers 409)
select pg_temp.expect_error6($q$insert into public.marketplace_order_terms (external_id, kind, app_slug, buyer_id, seller_id, fee_bps)
  values ('apixis:deal-0001', 'world_purchase', 'apixis', '66666666-6666-4666-8666-000000000001', null, 500)$q$, '23505');

-- terms move no money: the ledger is untouched
do $$
begin
  if exists (select 1 from public.ledger_transactions where external_id in ('apixis:deal-0001', 'apixis:shop-0001')) then
    raise exception 'terms must not write ledger rows';
  end if;
end $$;

select 'world order terms: ok';
