-- 004_capture_grants_entitlement.sql
-- Problem: capture_xp settled the money but recorded nothing about WHAT was bought,
-- so no sister site could ask the Wallet "does this user own X". The Wallet is the
-- single source of truth for entitlements (Awad's decision) — capture must write one.
--
-- 1. ledger_transactions.product_key — reserve records the SKU; capture copies it.
-- 2. reserve_xp gains a trailing optional p_product_key (same argument order as before;
--    the old 5-arg definition is dropped so there is exactly one function).
-- 3. capture_xp upserts public.entitlements on success. Idempotent (existing unique
--    key on owner_id, app_slug, product_key). Release grants nothing.

alter table public.ledger_transactions
  add column if not exists product_key text;

-- ---- reserve_xp: record the product on the hold ----------------------------
drop function if exists public.reserve_xp(uuid,bigint,text,text,text);
create or replace function public.reserve_xp(
  p_owner_id uuid,
  p_amount bigint,
  p_description text,
  p_external_id text,
  p_app_slug text default null,
  p_product_key text default null
) returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare v_wallet_id uuid; v_available bigint; v_tx_id uuid;
begin
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  v_wallet_id := get_or_create_wallet(p_owner_id);
  -- idempotent on external_id
  select id into v_tx_id from ledger_transactions where external_id = p_external_id and kind = 'reserve';
  if v_tx_id is not null then return v_tx_id; end if;
  select coalesce(available, 0) into v_available from wallet_balances where wallet_id = v_wallet_id;
  if coalesce(v_available, 0) < p_amount then
    raise exception 'Insufficient balance: available % Ixis, need %', coalesce(v_available, 0), p_amount;
  end if;
  insert into ledger_transactions (kind, description, app_slug, external_id, product_key)
  values ('reserve', p_description, p_app_slug, p_external_id, p_product_key) returning id into v_tx_id;
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'paid', -p_amount);
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'reserved', p_amount);
  return v_tx_id;
end; $$;

-- ---- capture_xp: settle AND grant ------------------------------------------
create or replace function public.capture_xp(p_reservation_id uuid, p_description text default 'Redemption captured')
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare v_wallet_id uuid; v_owner_id uuid; v_clearing_id uuid; v_amount bigint; v_tx_id uuid;
        v_external_id text; v_app_slug text; v_product_key text; v_kind text;
begin
  select lt.app_slug, lt.external_id, lt.product_key into v_app_slug, v_external_id, v_product_key
    from ledger_transactions lt where lt.id = p_reservation_id and lt.kind = 'reserve';
  if not found then raise exception 'Reservation % not found or not a reserve transaction', p_reservation_id; end if;

  -- idempotent: already settled → return that settlement; refuse to capture a released hold
  select id, kind into v_tx_id, v_kind from ledger_transactions where settles_reservation_id = p_reservation_id;
  if v_tx_id is not null then
    if v_kind <> 'spend' then raise exception 'Reservation % was already released', p_reservation_id; end if;
    return v_tx_id;
  end if;

  select le.wallet_id, sum(le.amount) into v_wallet_id, v_amount
    from ledger_entries le where le.transaction_id = p_reservation_id and le.bucket = 'reserved' group by le.wallet_id;
  if v_wallet_id is null or v_amount <= 0 then raise exception 'No reserved XP found for reservation %', p_reservation_id; end if;
  select owner_id into v_owner_id from wallets where id = v_wallet_id;
  select id into v_clearing_id from wallets where owner_id = '00000000-0000-0000-0000-000000000000'::uuid and currency = 'XP';

  insert into ledger_transactions (kind, description, app_slug, external_id, settles_reservation_id, product_key)
  values ('spend', p_description, v_app_slug, v_external_id || ':capture', p_reservation_id, v_product_key) returning id into v_tx_id;
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'reserved', -v_amount);
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_clearing_id, 'clearing', v_amount);

  -- the grant: what the customer now owns
  if v_product_key is not null then
    insert into entitlements (owner_id, app_slug, product_key, status, xp_price)
    values (v_owner_id, v_app_slug, v_product_key, 'active', v_amount)
    on conflict (owner_id, app_slug, product_key)
    do update set status = 'active', xp_price = excluded.xp_price, renews_at = null;
  end if;
  return v_tx_id;
end; $$;
