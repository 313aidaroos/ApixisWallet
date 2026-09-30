-- 011: marketplace orders (buyer → seller through the one ledger), 2026-09-30.
--
-- 1. Holds may last up to 30 days. Catalog redeems still default to 30 minutes; marketplace orders
--    (Ominix jobs) need a delivery window, and the expiry sweep releases what is never settled.
-- 2. audit_events gains 'payout' — the seller-side credit of a settled order.
--
-- reserve_xp is migration 010's function verbatim with one range check changed.

alter table public.audit_events drop constraint if exists audit_events_event_type_check;
alter table public.audit_events add constraint audit_events_event_type_check check (event_type in (
  'checkout_started', 'purchase', 'refund', 'dispute_lost', 'reserve', 'capture', 'release', 'redeem',
  'hold_expiry_sweep',
  'payout'              -- marketplace order settled → seller credited (amount − Apixis Bank fee)
));

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
  if p_hold_seconds is null or p_hold_seconds not between 60 and 2592000 then  -- up to 30 days (marketplace orders)
    raise exception 'Hold must be between 60 seconds and 30 days' using errcode = 'WA400';
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
