-- 007_launch_hardening.sql
-- Launch hardening for the Ixis ledger. Safe to re-run. Apply after 001–006.
--
-- Fixes (each reproduced on Postgres before this migration; see supabase/tests/):
--  1. Money functions were executable by anon/authenticated. Supabase grants EXECUTE on every new
--     public function to anon + authenticated by default, and these are SECURITY DEFINER, so anyone
--     holding the public key could call rpc('credit_xp') and mint Ixis. Now service_role only.
--  2. refund_xp (as rewritten in 003) CREDITED the customer. Its only caller is the Stripe
--     charge.refunded webhook, so a cash refund doubled the Ixis. It now reverses the purchase:
--     customer paid −amount, clearing +amount. The balance may go negative (Ixis already spent);
--     a negative balance blocks further redeems until topped up.
--  3. reserve_xp checked the balance without a lock; two concurrent reserves could overdraw.
--     All balance-reducing writes now lock the wallet row first.
--  4. release_xp on an already-CAPTURED hold returned success, so a site that released after a
--     lost capture response removed access from a customer who had been charged. It now raises
--     WA409 "already captured". Release also returns bonus Ixis to bonus (was: everything to paid).
--  5. Reserve idempotency keys were global and unchecked: a second request with the same key
--     (another site, another user, another product) got someone else's reservation back. A replay
--     must now match owner + product + amount, otherwise WA409. The API also namespaces keys by app.
--  6. Holds never expired. Holds now carry hold_expires_at (default 30 min); expired holds are
--     released lazily on the owner's next reserve and by release_expired_holds() (cron).
--  7. Time-limited SKUs (monthly seats) got renews_at = null, i.e. access forever. reserve_xp now
--     records entitlement_days; capture sets renews_at = now + days, stacking on an active period.
--  8. Ledger is enforced append-only, and every transaction must sum to zero (deferred check).
--  9. App slugs normalised: 'personalcontentbot' → 'contentbot', 'apixis.dev' → 'apixis'.
--
-- Custom SQLSTATEs raised here (the API maps them to HTTP):
--   WA400 bad input · WA402 insufficient balance · WA404 not found · WA409 conflict/already settled
--   WA403 append-only violation · WA500 unbalanced transaction

begin;

-- ---------------------------------------------------------------- columns & indexes
alter table public.ledger_transactions
  add column if not exists actor text,
  add column if not exists hold_expires_at timestamptz,
  add column if not exists entitlement_days integer;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ledger_transactions_entitlement_days_chk') then
    alter table public.ledger_transactions
      add constraint ledger_transactions_entitlement_days_chk check (entitlement_days is null or entitlement_days between 1 and 3660);
  end if;
end $$;

alter table public.entitlements
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists source_transaction_id uuid references public.ledger_transactions(id);

create index if not exists ledger_entries_wallet_bucket_idx on public.ledger_entries (wallet_id, bucket);
create index if not exists ledger_entries_transaction_idx on public.ledger_entries (transaction_id);
create index if not exists ledger_transactions_open_holds_idx on public.ledger_transactions (hold_expires_at) where kind = 'reserve';
create index if not exists ledger_transactions_kind_created_idx on public.ledger_transactions (kind, created_at desc);

-- ---------------------------------------------------------------- per-site API keys
-- One row per sister-site server. Only the SHA-256 of the key is stored. app_slugs limits which
-- apps' SKUs, reservations and entitlements the key may touch. Create with scripts/create-api-key.ts.
create table if not exists public.wallet_api_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  app_slugs text[] not null check (cardinality(app_slugs) > 0),
  key_prefix text not null,
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table public.wallet_api_clients enable row level security;
revoke all on public.wallet_api_clients from anon, authenticated;

-- ---------------------------------------------------------------- one-time data fixes (before append-only)
update public.ledger_transactions set app_slug = 'contentbot' where app_slug = 'personalcontentbot';
update public.ledger_transactions set app_slug = 'apixis' where app_slug = 'apixis.dev';
update public.entitlements e set app_slug = 'contentbot'
  where e.app_slug = 'personalcontentbot'
    and not exists (select 1 from public.entitlements x where x.owner_id = e.owner_id and x.app_slug = 'contentbot' and x.product_key = e.product_key);
update public.entitlements e set app_slug = 'apixis'
  where e.app_slug = 'apixis.dev'
    and not exists (select 1 from public.entitlements x where x.owner_id = e.owner_id and x.app_slug = 'apixis' and x.product_key = e.product_key);
-- Open holds from before this migration get a one-day expiry instead of living forever.
update public.ledger_transactions t set hold_expires_at = now() + interval '1 day'
  where t.kind = 'reserve' and t.hold_expires_at is null
    and not exists (select 1 from public.ledger_transactions s where s.settles_reservation_id = t.id);

-- ---------------------------------------------------------------- ledger invariants
create or replace function public.ledger_append_only() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'Ledger rows are append-only (% on %)', tg_op, tg_table_name using errcode = 'WA403';
end $$;

drop trigger if exists ledger_entries_append_only on public.ledger_entries;
create trigger ledger_entries_append_only before update or delete on public.ledger_entries
  for each row execute function public.ledger_append_only();
drop trigger if exists ledger_entries_no_truncate on public.ledger_entries;
create trigger ledger_entries_no_truncate before truncate on public.ledger_entries
  for each statement execute function public.ledger_append_only();
drop trigger if exists ledger_transactions_append_only on public.ledger_transactions;
create trigger ledger_transactions_append_only before update or delete on public.ledger_transactions
  for each row execute function public.ledger_append_only();
drop trigger if exists ledger_transactions_no_truncate on public.ledger_transactions;
create trigger ledger_transactions_no_truncate before truncate on public.ledger_transactions
  for each statement execute function public.ledger_append_only();

create or replace function public.ledger_assert_balanced() returns trigger
language plpgsql set search_path = public as $$
declare v_sum bigint;
begin
  select coalesce(sum(amount), 0) into v_sum from ledger_entries where transaction_id = new.transaction_id;
  if v_sum <> 0 then
    raise exception 'Ledger transaction % does not balance (sum %)', new.transaction_id, v_sum using errcode = 'WA500';
  end if;
  return null;
end $$;

drop trigger if exists ledger_entries_balanced on public.ledger_entries;
create constraint trigger ledger_entries_balanced after insert on public.ledger_entries
  deferrable initially deferred for each row execute function public.ledger_assert_balanced();

-- ---------------------------------------------------------------- balances view (adds paid/bonus split)
create or replace view public.wallet_balances with (security_invoker = true) as
select
  w.id as wallet_id,
  w.owner_id,
  coalesce(sum(e.amount) filter (where e.bucket in ('paid','bonus')), 0)::bigint as available_xp,
  coalesce(sum(e.amount) filter (where e.bucket = 'reserved'), 0)::bigint as reserved_xp,
  coalesce(sum(e.amount) filter (where e.bucket = 'paid'), 0)::bigint as paid_xp,
  coalesce(sum(e.amount) filter (where e.bucket = 'bonus'), 0)::bigint as bonus_xp
from public.wallets w
left join public.ledger_entries e on e.wallet_id = w.id
group by w.id, w.owner_id;
grant select on public.wallet_balances to authenticated;

-- ---------------------------------------------------------------- wallets
create or replace function public.get_or_create_wallet(p_owner_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_wallet_id uuid;
begin
  select id into v_wallet_id from wallets where owner_id = p_owner_id and currency = 'XP';
  if v_wallet_id is null then
    insert into wallets (owner_id, currency) values (p_owner_id, 'XP') on conflict (owner_id, currency) do nothing;
    select id into v_wallet_id from wallets where owner_id = p_owner_id and currency = 'XP';
  end if;
  return v_wallet_id;
end $$;

-- ---------------------------------------------------------------- credit (Stripe purchase / bonus)
create or replace function public.credit_xp(
  p_owner_id uuid,
  p_amount bigint,
  p_bucket text,
  p_description text,
  p_external_id text default null,
  p_app_slug text default null,
  p_expires_at timestamptz default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_wallet_id uuid; v_clearing_id uuid; v_tx_id uuid;
begin
  if p_owner_id is null or p_owner_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Invalid wallet owner' using errcode = 'WA400';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Credit amount must be positive' using errcode = 'WA400'; end if;
  if p_bucket not in ('paid','bonus') then raise exception 'Credit bucket must be paid or bonus' using errcode = 'WA400'; end if;

  if p_external_id is not null then
    select id into v_tx_id from ledger_transactions where external_id = p_external_id;
    if v_tx_id is not null then return v_tx_id; end if;
  end if;

  v_wallet_id := get_or_create_wallet(p_owner_id);
  v_clearing_id := get_or_create_wallet('00000000-0000-0000-0000-000000000000'::uuid);

  insert into ledger_transactions (external_id, kind, description, app_slug)
  values (p_external_id, case when p_bucket = 'bonus' then 'bonus' else 'purchase' end, p_description, p_app_slug)
  on conflict (external_id) do nothing
  returning id into v_tx_id;
  if v_tx_id is null then
    -- a concurrent delivery of the same event won the insert
    select id into v_tx_id from ledger_transactions where external_id = p_external_id;
    return v_tx_id;
  end if;

  insert into ledger_entries (transaction_id, wallet_id, bucket, amount, expires_at) values (v_tx_id, v_wallet_id, p_bucket, p_amount, p_expires_at);
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_clearing_id, 'clearing', -p_amount);
  return v_tx_id;
end $$;

-- ---------------------------------------------------------------- refund / chargeback: reverse a cash purchase
create or replace function public.refund_xp(
  p_owner_id uuid,
  p_amount bigint,
  p_description text,
  p_external_id text,
  p_app_slug text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_wallet_id uuid; v_clearing_id uuid; v_tx_id uuid;
begin
  if p_owner_id is null or p_owner_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Invalid wallet owner' using errcode = 'WA400';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Refund amount must be positive' using errcode = 'WA400'; end if;
  if p_external_id is null then raise exception 'Refund requires an external_id (idempotency key)' using errcode = 'WA400'; end if;

  v_wallet_id := get_or_create_wallet(p_owner_id);
  perform 1 from wallets where id = v_wallet_id for update;

  select id into v_tx_id from ledger_transactions where external_id = p_external_id;
  if v_tx_id is not null then return v_tx_id; end if;

  v_clearing_id := get_or_create_wallet('00000000-0000-0000-0000-000000000000'::uuid);
  insert into ledger_transactions (external_id, kind, description, app_slug, actor)
  values (p_external_id, 'refund', p_description, p_app_slug, 'stripe')
  returning id into v_tx_id;
  -- customer gave the cash back → the Ixis it bought leave the wallet
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'paid', -p_amount);
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_clearing_id, 'clearing', p_amount);
  return v_tx_id;
end $$;

-- ---------------------------------------------------------------- release (internal, no app scoping)
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

  insert into ledger_transactions (kind, description, app_slug, external_id, settles_reservation_id, product_key, actor)
  values ('release', p_description, v_res.app_slug, v_res.external_id || ':release', p_reservation_id, v_res.product_key, p_actor)
  returning id into v_tx_id;
  insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'reserved', -v_held);
  if v_from_paid > 0 then
    insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'paid', v_from_paid);
  end if;
  if v_from_bonus > 0 then
    insert into ledger_entries (transaction_id, wallet_id, bucket, amount) values (v_tx_id, v_wallet_id, 'bonus', v_from_bonus);
  end if;
  return v_tx_id;
end $$;

-- ---------------------------------------------------------------- reserve (hold)
drop function if exists public.reserve_xp(uuid, bigint, text, text, text);
drop function if exists public.reserve_xp(uuid, bigint, text, text, text, text);
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
     and not exists (select 1 from ledger_transactions s where s.settles_reservation_id = t.id);

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

-- ---------------------------------------------------------------- capture (settle + grant)
drop function if exists public.capture_xp(uuid, text);
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

  insert into ledger_transactions (kind, description, app_slug, external_id, settles_reservation_id, product_key, actor)
  values ('spend', p_description, v_res.app_slug, v_res.external_id || ':capture', p_reservation_id, v_res.product_key, p_actor)
  returning id into v_tx_id;
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
      -- time-limited: extend from the later of now and the current period end; one-time: no end
      renews_at = case
        when v_res.entitlement_days is null then null
        else greatest(coalesce(entitlements.renews_at, now()), now()) + make_interval(days => v_res.entitlement_days)
      end;
  end if;
  return v_tx_id;
end $$;

-- ---------------------------------------------------------------- release (API, app-scoped)
drop function if exists public.release_xp(uuid, text);
create or replace function public.release_xp(
  p_reservation_id uuid,
  p_description text default 'Reservation released',
  p_actor text default null,
  p_allowed_apps text[] default null
)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if p_allowed_apps is not null and not exists (
    select 1 from ledger_transactions where id = p_reservation_id and kind = 'reserve' and app_slug = any (p_allowed_apps)
  ) then
    raise exception 'Reservation % not found', p_reservation_id using errcode = 'WA404';
  end if;
  return release_hold_internal(p_reservation_id, p_description, p_actor);
end $$;

-- ---------------------------------------------------------------- expiry sweep (cron)
create or replace function public.release_expired_holds(p_limit integer default 500)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; v_count integer := 0;
begin
  for r in
    select t.id from ledger_transactions t
     where t.kind = 'reserve' and t.hold_expires_at < now()
       and not exists (select 1 from ledger_transactions s where s.settles_reservation_id = t.id)
     order by t.hold_expires_at
     limit greatest(least(p_limit, 5000), 1)
  loop
    begin
      perform release_hold_internal(r.id, 'Hold expired', 'system:expiry');
      v_count := v_count + 1;
    exception when sqlstate 'WA409' or sqlstate 'WA404' then
      null; -- settled concurrently
    end;
  end loop;
  return v_count;
end $$;

-- ---------------------------------------------------------------- history (one row per transaction)
create or replace function public.wallet_history(p_owner_id uuid, p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, kind text, description text, app_slug text, product_key text, created_at timestamptz,
  available_delta bigint, held_delta bigint, total_count bigint
)
language sql stable security definer set search_path = public as $$
  with w as (select wallets.id from wallets where owner_id = p_owner_id and currency = 'XP'),
  tx as (
    select t.id, t.kind, t.description, t.app_slug, t.product_key, t.created_at,
           coalesce(sum(e.amount) filter (where e.bucket in ('paid','bonus')), 0)::bigint as available_delta,
           coalesce(sum(e.amount) filter (where e.bucket = 'reserved'), 0)::bigint as held_delta
      from ledger_entries e
      join w on w.id = e.wallet_id
      join ledger_transactions t on t.id = e.transaction_id
     group by t.id
  )
  select tx.id, tx.kind, tx.description, tx.app_slug, tx.product_key, tx.created_at,
         tx.available_delta, tx.held_delta, count(*) over ()::bigint
    from tx
   order by tx.created_at desc, tx.id
   limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- ---------------------------------------------------------------- lock down execution
-- Explicit names only: this project may be shared with other apps' public functions.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in (
       'get_or_create_wallet','credit_xp','refund_xp','reserve_xp','capture_xp','release_xp',
       'release_hold_internal','release_expired_holds','wallet_history','find_user_id_by_email',
       'ledger_append_only','ledger_assert_balanced')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
