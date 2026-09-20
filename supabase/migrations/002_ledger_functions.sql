-- Atomic ledger functions for Apixis Wallet
-- All writes happen server-side. Never modify wallets.balance directly.
-- Every transaction must balance to zero across customer + clearing wallets.

-- Helper to get or create a wallet for an owner
create or replace function get_or_create_wallet(p_owner_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
begin
  select id into v_wallet_id from wallets where owner_id = p_owner_id and currency = 'XP';
  if v_wallet_id is null then
    insert into wallets (owner_id, currency) values (p_owner_id, 'XP') returning id into v_wallet_id;
  end if;
  return v_wallet_id;
end;
$$;

-- CREDIT: add paid or bonus XP (purchases, bonuses, refunds)
-- Balances to a clearing wallet entry.
create or replace function credit_xp(
  p_owner_id uuid,
  p_amount bigint,
  p_bucket text,
  p_description text,
  p_external_id text default null,
  p_app_slug text default null,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_clearing_id uuid;
  v_tx_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'Credit amount must be positive';
  end if;
  if p_bucket not in ('paid','bonus') then
    raise exception 'Credit bucket must be paid or bonus';
  end if;
  
  -- Check idempotency
  if p_external_id is not null then
    select id into v_tx_id from ledger_transactions where external_id = p_external_id;
    if v_tx_id is not null then
      return v_tx_id; -- already applied
    end if;
  end if;

  v_wallet_id := get_or_create_wallet(p_owner_id);
  
  -- Get or create clearing wallet (system wallet for double-entry)
  select id into v_clearing_id from wallets where owner_id = '00000000-0000-0000-0000-000000000000'::uuid and currency = 'XP';
  if v_clearing_id is null then
    insert into wallets (id, owner_id, currency) 
    values ('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'XP')
    returning id into v_clearing_id;
  end if;

  insert into ledger_transactions (external_id, kind, description, app_slug)
  values (p_external_id, 'purchase', p_description, p_app_slug)
  returning id into v_tx_id;

  insert into ledger_entries (transaction_id, wallet_id, bucket, amount, expires_at)
  values (v_tx_id, v_wallet_id, p_bucket, p_amount, p_expires_at);

  insert into ledger_entries (transaction_id, wallet_id, bucket, amount)
  values (v_tx_id, v_clearing_id, 'clearing', -p_amount);

  return v_tx_id;
end;
$$;

-- RESERVE: hold XP for a pending redemption (quote accepted, not yet captured)
-- Returns reservation_id (transaction_id) for later capture/release.
create or replace function reserve_xp(
  p_owner_id uuid,
  p_amount bigint,
  p_description text,
  p_external_id text,
  p_app_slug text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_tx_id uuid;
  v_available bigint;
begin
  if p_amount <= 0 then
    raise exception 'Reserve amount must be positive';
  end if;
  if p_external_id is null then
    raise exception 'Reserve requires an external_id (idempotency key)';
  end if;
  
  -- Check idempotency
  select id into v_tx_id from ledger_transactions where external_id = p_external_id;
  if v_tx_id is not null then
    return v_tx_id; -- already reserved
  end if;

  v_wallet_id := get_or_create_wallet(p_owner_id);

  -- Check available balance (paid + bonus - reserved)
  select available_xp into v_available from wallet_balances where wallet_id = v_wallet_id;
  if v_available < p_amount then
    raise exception 'Insufficient balance: % available, % requested', v_available, p_amount;
  end if;

  insert into ledger_transactions (external_id, kind, description, app_slug)
  values (p_external_id, 'reserve', p_description, p_app_slug)
  returning id into v_tx_id;

  -- Move from paid/bonus to reserved (spend bonus first if available, then paid)
  declare
    v_bonus bigint;
    v_remaining bigint := p_amount;
  begin
    select coalesce(sum(amount),0) into v_bonus from ledger_entries where wallet_id = v_wallet_id and bucket = 'bonus';
    if v_bonus > 0 then
      if v_bonus >= v_remaining then
        insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'bonus', -v_remaining);
        insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'reserved', v_remaining);
        v_remaining := 0;
      else
        insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'bonus', -v_bonus);
        insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'reserved', v_bonus);
        v_remaining := v_remaining - v_bonus;
      end if;
    end if;

    if v_remaining > 0 then
      insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'paid', -v_remaining);
      insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'reserved', v_remaining);
    end if;
  end;

  return v_tx_id;
end;
$$;

-- CAPTURE: finalize a reservation (redemption succeeded)
-- Moves reserved XP to clearing (spend complete).
create or replace function capture_xp(
  p_reservation_id uuid,
  p_description text default 'Redemption captured'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_clearing_id uuid;
  v_amount bigint;
  v_tx_id uuid;
  v_external_id text;
  v_app_slug text;
begin
  -- Find the reservation
  select lt.app_slug, lt.external_id into v_app_slug, v_external_id
  from ledger_transactions lt where lt.id = p_reservation_id and lt.kind = 'reserve';
  if not found then
    raise exception 'Reservation % not found or not a reserve transaction', p_reservation_id;
  end if;

  -- Check if already captured (idempotency on reservation_id)
  select id into v_tx_id from ledger_transactions where kind = 'spend' and description like '%' || p_reservation_id::text || '%';
  if v_tx_id is not null then
    return v_tx_id; -- already captured
  end if;

  -- Find wallet and reserved amount
  select wallet_id, sum(amount) into v_wallet_id, v_amount
  from ledger_entries where transaction_id = p_reservation_id and bucket = 'reserved'
  group by wallet_id;

  if v_wallet_id is null or v_amount <= 0 then
    raise exception 'No reserved XP found for reservation %', p_reservation_id;
  end if;

  select id into v_clearing_id from wallets where owner_id = '00000000-0000-0000-0000-000000000000'::uuid and currency = 'XP';

  insert into ledger_transactions (kind, description, app_slug, external_id)
  values ('spend', p_description || ' [res:' || p_reservation_id || ']', v_app_slug, v_external_id || ':capture')
  returning id into v_tx_id;

  insert into ledger_entries (transaction_id, wallet_id, bucket, amount)
  values (v_tx_id, v_wallet_id, 'reserved', -v_amount);

  insert into ledger_entries (transaction_id, wallet_id, bucket, amount)
  values (v_tx_id, v_clearing_id, 'clearing', v_amount);

  return v_tx_id;
end;
$$;

-- RELEASE: cancel a reservation (redemption failed or timed out)
-- Returns reserved XP back to paid/bonus.
create or replace function release_xp(
  p_reservation_id uuid,
  p_description text default 'Reservation released'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_amount bigint;
  v_tx_id uuid;
  v_external_id text;
  v_app_slug text;
begin
  -- Find the reservation
  select lt.app_slug, lt.external_id into v_app_slug, v_external_id
  from ledger_transactions lt where lt.id = p_reservation_id and lt.kind = 'reserve';
  if not found then
    raise exception 'Reservation % not found or not a reserve transaction', p_reservation_id;
  end if;

  -- Check if already released (idempotency)
  select id into v_tx_id from ledger_transactions where kind = 'release' and description like '%' || p_reservation_id::text || '%';
  if v_tx_id is not null then
    return v_tx_id; -- already released
  end if;

  -- Find wallet and reserved amount
  select wallet_id, sum(amount) into v_wallet_id, v_amount
  from ledger_entries where transaction_id = p_reservation_id and bucket = 'reserved'
  group by wallet_id;

  if v_wallet_id is null or v_amount <= 0 then
    raise exception 'No reserved XP found for reservation %', p_reservation_id;
  end if;

  insert into ledger_transactions (kind, description, app_slug, external_id)
  values ('release', p_description || ' [res:' || p_reservation_id || ']', v_app_slug, v_external_id || ':release')
  returning id into v_tx_id;

  -- Return to paid bucket (simplification: could track origin bucket for bonus)
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount)
  values (v_tx_id, v_wallet_id, 'reserved', -v_amount);

  insert into ledger_entries (transaction_id, wallet_id, bucket, amount)
  values (v_tx_id, v_wallet_id, 'paid', v_amount);

  return v_tx_id;
end;
$$;

-- REFUND: reverse a purchase (Stripe refund)
-- Returns paid XP back to clearing and debits the user wallet.
create or replace function refund_xp(
  p_owner_id uuid,
  p_amount bigint,
  p_description text,
  p_external_id text,
  p_app_slug text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_clearing_id uuid;
  v_tx_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'Refund amount must be positive';
  end if;
  if p_external_id is null then
    raise exception 'Refund requires an external_id (idempotency key)';
  end if;
  
  -- Check idempotency
  select id into v_tx_id from ledger_transactions where external_id = p_external_id;
  if v_tx_id is not null then
    return v_tx_id; -- already refunded
  end if;

  v_wallet_id := get_or_create_wallet(p_owner_id);
  
  select id into v_clearing_id from wallets where owner_id = '00000000-0000-0000-0000-000000000000'::uuid and currency = 'XP';

  insert into ledger_transactions (external_id, kind, description, app_slug)
  values (p_external_id, 'refund', p_description, p_app_slug)
  returning id into v_tx_id;

  insert into ledger_entries (transaction_id, wallet_id, bucket, amount)
  values (v_tx_id, v_wallet_id, 'paid', -p_amount);

  insert into ledger_entries (transaction_id, wallet_id, bucket, amount)
  values (v_tx_id, v_clearing_id, 'clearing', p_amount);

  return v_tx_id;
end;
$$;

-- Grant execute to authenticated service role only (server-side calls)
grant execute on function get_or_create_wallet(uuid) to service_role;
grant execute on function credit_xp(uuid, bigint, text, text, text, text, timestamptz) to service_role;
grant execute on function reserve_xp(uuid, bigint, text, text, text) to service_role;
grant execute on function capture_xp(uuid, text) to service_role;
grant execute on function release_xp(uuid, text) to service_role;
grant execute on function refund_xp(uuid, bigint, text, text, text) to service_role;
