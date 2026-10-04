-- 013_signup_grant.sql — the sanctioned Apixis ID welcome grant + bonus-safe marketplace payouts.
-- 2026-10-04, Grok (Wallet executor), hub decisions under Awad's locks. Additive and safe to re-run.
--
-- 1. signup_grants: at most ONE welcome grant per Apixis ID (Wallet auth user), ever. owner_id is the
--    primary key; the lower-cased email is unique too, so deleting and re-creating an address can't
--    farm a second grant. The ledger id `signup_grant:<owner>` is a third guard (external_id unique).
-- 2. grant_signup_xp(owner, source, actor, ip, user_agent): credits 1,000 Ixis (constant in SQL, not
--    a parameter) to the owner's BONUS bucket: kind 'bonus', app 'wallet', balanced against clearing.
--    Requires a confirmed email and a real sign-in (auth.users.last_sign_in_at). Refuses to push the
--    outstanding liability above the hard mint ceiling (1,000,000,000,000 Ixis, lib/ixis-asset/supply.ts).
--    Writes the signup_grants row and an audit_events row ('signup_grant') in the same transaction.
--    No fee (a grant is not a trade). Non-withdrawable like every Ixis; spendable, spent first.
--    Callers: lib/signup-grant.ts only, behind SIGNUP_GRANT_ENABLED (default OFF).
-- 3. revoke_signup_grant(owner, reason, actor): claw-back. Posts an 'adjustment' moving whatever is
--    left of the grant (min(1,000, current bonus balance), never below zero) back to clearing,
--    stamps revoked_at and audits 'signup_grant_revoke'. Idempotent. The ledger stays append-only.
-- 4. settle_marketplace_payout(reservation, seller, payout, …): the seller side of a marketplace
--    settle. Bonus-funded Ixis stay bonus: the payout is split in the same ratio as the buyer's hold
--    was funded, paid share rounded DOWN, so free Ixis can never become paid Ixis. One transaction,
--    idempotent on the same `<hold external_id>:payout` key the route already used.
-- All four functions are SECURITY DEFINER and service_role only (AGENTS.md rule 2).

begin;

-- ---------------------------------------------------------------- audit types
alter table public.audit_events drop constraint if exists audit_events_event_type_check;
alter table public.audit_events add constraint audit_events_event_type_check check (event_type in (
  'checkout_started', 'purchase', 'refund', 'dispute_lost', 'reserve', 'capture', 'release', 'redeem',
  'hold_expiry_sweep',
  'payout',               -- marketplace order settled → seller credited (amount − Apixis Bank fee)
  'signup_grant',         -- Apixis ID welcome grant credited (bonus bucket)
  'signup_grant_revoke'   -- welcome grant clawed back
));

-- ---------------------------------------------------------------- grants table
create table if not exists public.signup_grants (
  owner_id uuid primary key references auth.users(id),
  email text not null,
  transaction_id uuid not null unique references public.ledger_transactions(id),
  amount bigint not null check (amount > 0),
  source text not null,
  actor text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoke_reason text,
  revoke_transaction_id uuid references public.ledger_transactions(id),
  clawed_back bigint check (clawed_back is null or clawed_back >= 0)
);
create unique index if not exists signup_grants_email_uidx on public.signup_grants (lower(email));
create index if not exists signup_grants_created_idx on public.signup_grants (created_at desc);
alter table public.signup_grants enable row level security;
revoke all on public.signup_grants from public, anon, authenticated;
grant select on public.signup_grants to service_role;

-- ---------------------------------------------------------------- grant
create or replace function public.grant_signup_xp(
  p_owner_id uuid,
  p_source text,
  p_actor text default null,
  p_ip text default null,
  p_user_agent text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c_amount constant bigint := 1000;                       -- Awad's lock: 1,000 Ixis per Apixis ID
  c_max_supply constant bigint := 1000000000000;          -- IXIS_MAX_SUPPLY (lib/ixis-asset/supply.ts)
  c_description constant text := 'Welcome grant · 1,000 free Ixis for your Apixis ID';
  c_clearing constant uuid := '00000000-0000-0000-0000-000000000000';
  v_user record; v_email text; v_wallet_id uuid; v_clearing_id uuid; v_tx_id uuid;
  v_existing record; v_liability bigint; v_source text; v_actor text;
begin
  if p_owner_id is null or p_owner_id = c_clearing then
    raise exception 'Invalid wallet owner' using errcode = 'WA400';
  end if;
  v_source := coalesce(nullif(left(trim(coalesce(p_source, '')), 40), ''), 'unknown');
  v_actor := coalesce(nullif(left(trim(coalesce(p_actor, '')), 80), ''), 'system:signup-grant');

  select id, email, email_confirmed_at, last_sign_in_at into v_user from auth.users where id = p_owner_id;
  if not found then return jsonb_build_object('granted', false, 'reason', 'no_user'); end if;
  v_email := lower(trim(coalesce(v_user.email, '')));
  if v_email = '' then return jsonb_build_object('granted', false, 'reason', 'no_email'); end if;
  if v_user.email_confirmed_at is null then return jsonb_build_object('granted', false, 'reason', 'email_not_confirmed'); end if;
  if v_user.last_sign_in_at is null then return jsonb_build_object('granted', false, 'reason', 'no_sign_in'); end if;

  v_wallet_id := get_or_create_wallet(p_owner_id);
  perform 1 from wallets where id = v_wallet_id for update;   -- serialise with every other write on this wallet

  select owner_id, transaction_id into v_existing from signup_grants where owner_id = p_owner_id;
  if found then
    return jsonb_build_object('granted', false, 'reason', 'already_granted', 'transaction_id', v_existing.transaction_id);
  end if;
  if exists (select 1 from signup_grants where lower(email) = v_email) then
    return jsonb_build_object('granted', false, 'reason', 'email_already_granted');
  end if;

  -- Mint ceiling: outstanding liability = every customer's paid + bonus + reserved Ixis.
  select coalesce(sum(e.amount), 0) into v_liability
    from ledger_entries e join wallets w on w.id = e.wallet_id
   where w.owner_id <> c_clearing and e.bucket in ('paid', 'bonus', 'reserved');
  if v_liability + c_amount > c_max_supply then
    raise exception 'Signup grant would exceed IXIS_MAX_SUPPLY (liability %)', v_liability using errcode = 'WA409';
  end if;

  v_clearing_id := get_or_create_wallet(c_clearing);
  insert into ledger_transactions (external_id, kind, description, app_slug, actor)
  values ('signup_grant:' || p_owner_id::text, 'bonus', c_description, 'wallet', v_actor)
  on conflict (external_id) do nothing
  returning id into v_tx_id;
  if v_tx_id is null then
    -- A ledger row without a grants row should be impossible; refuse rather than guess.
    raise exception 'Signup grant ledger row exists without a grant record for %', p_owner_id using errcode = 'WA409';
  end if;
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'bonus', c_amount);
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_clearing_id, 'clearing', -c_amount);

  insert into signup_grants (owner_id, email, transaction_id, amount, source, actor)
  values (p_owner_id, v_email, v_tx_id, c_amount, v_source, v_actor);

  insert into audit_events (event_type, dedupe_key, actor, app_slug, owner_id, owner_email, ledger_transaction_id,
                            amount_ixis, ip_address, user_agent, details)
  values ('signup_grant', 'signup_grant:' || p_owner_id::text, v_actor, 'wallet', p_owner_id, v_email, v_tx_id,
          c_amount, left(p_ip, 64), left(p_user_agent, 400),
          jsonb_build_object('source', v_source, 'bucket', 'bonus', 'fee_ixis', 0,
                             'liability_before', v_liability, 'max_supply', c_max_supply))
  on conflict (dedupe_key) do nothing;

  return jsonb_build_object('granted', true, 'reason', 'granted', 'transaction_id', v_tx_id, 'amount', c_amount);
end $$;

-- ---------------------------------------------------------------- claw-back
create or replace function public.revoke_signup_grant(p_owner_id uuid, p_reason text, p_actor text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c_clearing constant uuid := '00000000-0000-0000-0000-000000000000';
  v_grant record; v_wallet_id uuid; v_clearing_id uuid; v_bonus bigint; v_take bigint; v_tx_id uuid; v_actor text;
begin
  if p_owner_id is null or p_owner_id = c_clearing then
    raise exception 'Invalid wallet owner' using errcode = 'WA400';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'A claw-back needs a reason' using errcode = 'WA400';
  end if;
  v_actor := coalesce(nullif(left(trim(coalesce(p_actor, '')), 80), ''), 'system:signup-grant');

  select w.id into v_wallet_id from wallets w where w.owner_id = p_owner_id and w.currency = 'XP';
  if v_wallet_id is not null then perform 1 from wallets where id = v_wallet_id for update; end if;

  select * into v_grant from signup_grants where owner_id = p_owner_id for update;
  if not found then raise exception 'No signup grant for %', p_owner_id using errcode = 'WA404'; end if;
  if v_grant.revoked_at is not null then
    return jsonb_build_object('revoked', false, 'reason', 'already_revoked', 'clawed_back', v_grant.clawed_back,
                              'transaction_id', v_grant.revoke_transaction_id);
  end if;

  select coalesce(sum(amount), 0) into v_bonus from ledger_entries where wallet_id = v_wallet_id and bucket = 'bonus';
  v_take := least(v_grant.amount, greatest(v_bonus, 0));   -- never drives the bonus bucket negative

  if v_take > 0 then
    v_clearing_id := get_or_create_wallet(c_clearing);
    insert into ledger_transactions (external_id, kind, description, app_slug, actor)
    values ('signup_grant_revoke:' || p_owner_id::text, 'adjustment', 'Welcome grant reversed: ' || left(trim(p_reason), 120), 'wallet', v_actor)
    returning id into v_tx_id;
    insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'bonus', -v_take);
    insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_clearing_id, 'clearing', v_take);
  end if;

  update signup_grants set revoked_at = now(), revoke_reason = left(trim(p_reason), 200),
         revoke_transaction_id = v_tx_id, clawed_back = v_take
   where owner_id = p_owner_id;

  insert into audit_events (event_type, dedupe_key, actor, app_slug, owner_id, owner_email, ledger_transaction_id, amount_ixis, details)
  values ('signup_grant_revoke', 'signup_grant_revoke:' || p_owner_id::text, v_actor, 'wallet', p_owner_id, v_grant.email, v_tx_id,
          v_take, jsonb_build_object('reason', left(trim(p_reason), 200), 'granted', v_grant.amount, 'bonus_before', v_bonus))
  on conflict (dedupe_key) do nothing;

  return jsonb_build_object('revoked', true, 'clawed_back', v_take, 'transaction_id', v_tx_id);
end $$;

-- ---------------------------------------------------------------- marketplace payout (bonus stays bonus)
-- Rule: the seller's payout is split in the ratio the buyer's hold was funded.
--   paid_out  = floor(payout × held_from_paid / held_total)   (rounded DOWN)
--   bonus_out = payout − paid_out                              (the rounding remainder is bonus)
-- So paid_out ≤ held_from_paid always: no settle turns free Ixis into paid Ixis. The fee keeps the
-- same mix in clearing. Pure-paid holds pay all paid (unchanged); pure-bonus holds pay all bonus.
create or replace function public.settle_marketplace_payout(
  p_reservation_id uuid,
  p_seller_id uuid,
  p_payout bigint,
  p_description text,
  p_external_id text,
  p_app_slug text default null,
  p_actor text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c_clearing constant uuid := '00000000-0000-0000-0000-000000000000';
  v_res record; v_buyer_wallet uuid; v_total bigint; v_from_paid bigint; v_from_bonus bigint;
  v_paid bigint; v_bonus bigint; v_wallet_id uuid; v_clearing_id uuid; v_tx_id uuid; v_existing uuid;
begin
  if p_seller_id is null or p_seller_id = c_clearing then
    raise exception 'Invalid seller' using errcode = 'WA400';
  end if;
  if p_payout is null or p_payout <= 0 then raise exception 'Payout must be positive' using errcode = 'WA400'; end if;
  if p_external_id is null or length(p_external_id) < 8 then
    raise exception 'Payout requires an external_id (idempotency key)' using errcode = 'WA400';
  end if;

  -- Idempotent replay (also covers payouts written by the pre-013 credit_xp path under the same key).
  select id into v_existing from ledger_transactions where external_id = p_external_id;
  if v_existing is not null then
    return jsonb_build_object('transaction_id', v_existing, 'replay', true,
      'paid', (select coalesce(sum(amount), 0) from ledger_entries where transaction_id = v_existing and bucket = 'paid'),
      'bonus', (select coalesce(sum(amount), 0) from ledger_entries where transaction_id = v_existing and bucket = 'bonus'));
  end if;

  select id, external_id into v_res from ledger_transactions where id = p_reservation_id and kind = 'reserve';
  if not found then raise exception 'Reservation % not found', p_reservation_id using errcode = 'WA404'; end if;
  if not exists (select 1 from ledger_transactions where settles_reservation_id = p_reservation_id and kind = 'spend') then
    raise exception 'Reservation % is not captured', p_reservation_id using errcode = 'WA409';
  end if;

  select wallet_id, sum(amount) into v_buyer_wallet, v_total
    from ledger_entries where transaction_id = p_reservation_id and bucket = 'reserved' group by wallet_id;
  if v_buyer_wallet is null or v_total <= 0 then
    raise exception 'No reserved Ixis found for reservation %', p_reservation_id using errcode = 'WA404';
  end if;
  if p_payout > v_total then
    raise exception 'Payout % exceeds the order amount %', p_payout, v_total using errcode = 'WA400';
  end if;
  select -coalesce(sum(amount) filter (where bucket = 'paid'), 0), -coalesce(sum(amount) filter (where bucket = 'bonus'), 0)
    into v_from_paid, v_from_bonus
    from ledger_entries where transaction_id = p_reservation_id and wallet_id = v_buyer_wallet;
  if v_from_paid < 0 or v_from_bonus < 0 or v_from_paid + v_from_bonus <> v_total then
    raise exception 'Reservation % has an unexpected funding mix', p_reservation_id using errcode = 'WA500';
  end if;

  v_paid := (p_payout * v_from_paid) / v_total;   -- integer division = floor for non-negatives
  v_bonus := p_payout - v_paid;

  v_wallet_id := get_or_create_wallet(p_seller_id);
  v_clearing_id := get_or_create_wallet(c_clearing);
  insert into ledger_transactions (external_id, kind, description, app_slug, actor)
  values (p_external_id, case when v_paid > 0 then 'purchase' else 'bonus' end, p_description, p_app_slug, p_actor)
  on conflict (external_id) do nothing
  returning id into v_tx_id;
  if v_tx_id is null then
    select id into v_tx_id from ledger_transactions where external_id = p_external_id;
    return jsonb_build_object('transaction_id', v_tx_id, 'replay', true);
  end if;
  if v_paid > 0 then
    insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'paid', v_paid);
  end if;
  if v_bonus > 0 then
    insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'bonus', v_bonus);
  end if;
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_clearing_id, 'clearing', -p_payout);
  return jsonb_build_object('transaction_id', v_tx_id, 'replay', false, 'paid', v_paid, 'bonus', v_bonus,
                            'held_from_paid', v_from_paid, 'held_from_bonus', v_from_bonus);
end $$;

-- ---------------------------------------------------------------- lock down execution
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('grant_signup_xp', 'revoke_signup_grant', 'settle_marketplace_payout')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
