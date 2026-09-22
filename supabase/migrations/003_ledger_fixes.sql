-- 003_ledger_fixes.sql
-- Fixes found by end-to-end ledger test on 2026-09-22 before any customer used the wallet.
--
-- 1. refund_xp debited the customer instead of crediting them (sign error). A refund must
--    ADD paid Ixis back to the customer and DEBIT the clearing wallet.
-- 2. capture_xp / release_xp detected "already done" by LIKE-matching the reservation id
--    inside the free-text description. Replace with a real column + unique index so
--    idempotency is structural, not string-based.
-- 3. Seed the system clearing wallet owner (all-zeros uuid) so the first real credit does
--    not fail on the auth.users foreign key.

-- 3. clearing owner (idempotent)
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000','authenticated','authenticated','clearing@apixis.dev','', now(), now(), now(), '{"provider":"system"}','{"system":"ixis-clearing"}')
on conflict (id) do nothing;
select get_or_create_wallet('00000000-0000-0000-0000-000000000000');

-- 2. structural idempotency for capture/release
alter table public.ledger_transactions add column if not exists settles_reservation_id uuid references public.ledger_transactions(id);
create unique index if not exists ledger_transactions_settles_reservation_uidx on public.ledger_transactions(settles_reservation_id) where settles_reservation_id is not null;

create or replace function capture_xp(p_reservation_id uuid, p_description text default 'Redemption captured')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_wallet_id uuid; v_clearing_id uuid; v_amount bigint; v_tx_id uuid; v_external_id text; v_app_slug text;
begin
  select lt.app_slug, lt.external_id into v_app_slug, v_external_id from ledger_transactions lt where lt.id = p_reservation_id and lt.kind = 'reserve';
  if not found then raise exception 'Reservation % not found or not a reserve transaction', p_reservation_id; end if;
  -- idempotent: already settled (captured OR released) -> return that settlement
  select id into v_tx_id from ledger_transactions where settles_reservation_id = p_reservation_id;
  if v_tx_id is not null then return v_tx_id; end if;
  select wallet_id, sum(amount) into v_wallet_id, v_amount from ledger_entries where transaction_id = p_reservation_id and bucket = 'reserved' group by wallet_id;
  if v_wallet_id is null or v_amount <= 0 then raise exception 'No reserved XP found for reservation %', p_reservation_id; end if;
  select id into v_clearing_id from wallets where owner_id = '00000000-0000-0000-0000-000000000000'::uuid and currency = 'XP';
  insert into ledger_transactions (kind, description, app_slug, external_id, settles_reservation_id)
  values ('spend', p_description, v_app_slug, v_external_id || ':capture', p_reservation_id) returning id into v_tx_id;
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'reserved', -v_amount);
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_clearing_id, 'clearing', v_amount);
  return v_tx_id;
end; $$;

create or replace function release_xp(p_reservation_id uuid, p_description text default 'Reservation released')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_wallet_id uuid; v_amount bigint; v_tx_id uuid; v_external_id text; v_app_slug text;
begin
  select lt.app_slug, lt.external_id into v_app_slug, v_external_id from ledger_transactions lt where lt.id = p_reservation_id and lt.kind = 'reserve';
  if not found then raise exception 'Reservation % not found or not a reserve transaction', p_reservation_id; end if;
  select id into v_tx_id from ledger_transactions where settles_reservation_id = p_reservation_id;
  if v_tx_id is not null then return v_tx_id; end if;
  select wallet_id, sum(amount) into v_wallet_id, v_amount from ledger_entries where transaction_id = p_reservation_id and bucket = 'reserved' group by wallet_id;
  if v_wallet_id is null or v_amount <= 0 then raise exception 'No reserved XP found for reservation %', p_reservation_id; end if;
  insert into ledger_transactions (kind, description, app_slug, external_id, settles_reservation_id)
  values ('release', p_description, v_app_slug, v_external_id || ':release', p_reservation_id) returning id into v_tx_id;
  -- move reserved back to paid, same wallet, nets to zero
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'reserved', -v_amount);
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'paid', v_amount);
  return v_tx_id;
end; $$;

-- 1. refund gives money BACK
create or replace function refund_xp(p_owner_id uuid, p_amount bigint, p_description text, p_external_id text, p_app_slug text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_wallet_id uuid; v_clearing_id uuid; v_tx_id uuid;
begin
  if p_amount <= 0 then raise exception 'Refund amount must be positive'; end if;
  if p_external_id is null then raise exception 'Refund requires an external_id (idempotency key)'; end if;
  select id into v_tx_id from ledger_transactions where external_id = p_external_id;
  if v_tx_id is not null then return v_tx_id; end if;
  v_wallet_id := get_or_create_wallet(p_owner_id);
  select id into v_clearing_id from wallets where owner_id = '00000000-0000-0000-0000-000000000000'::uuid and currency = 'XP';
  insert into ledger_transactions (external_id, kind, description, app_slug) values (p_external_id, 'refund', p_description, p_app_slug) returning id into v_tx_id;
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'paid', p_amount);        -- customer +
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_clearing_id, 'clearing', -p_amount); -- clearing -
  return v_tx_id;
end; $$;

grant execute on function capture_xp(uuid, text) to service_role;
grant execute on function release_xp(uuid, text) to service_role;
grant execute on function refund_xp(uuid, bigint, text, text, text) to service_role;
