-- 016_monthly_subscriptions.sql
-- Customer-chosen monthly seats. Ixis renewals spend the catalog price through reserve + capture.
-- Card renewals are Stripe subscriptions; invoice.paid credits that price and then spends it.
-- No mint, no cash-out. Safe to re-run. Apply after 013. Includes checkout_payment_failed so a
-- later re-run of 015 will not drop these types (015 skips when subscription_renewed is present).

begin;

alter table public.audit_events drop constraint if exists audit_events_event_type_check;
alter table public.audit_events add constraint audit_events_event_type_check check (event_type in (
  'checkout_started', 'purchase', 'refund', 'dispute_lost', 'reserve', 'capture', 'release', 'redeem',
  'hold_expiry_sweep',
  'payout',
  'signup_grant',
  'signup_grant_revoke',
  'checkout_payment_failed',
  'subscription_enrolled',
  'subscription_renewed',
  'subscription_past_due',
  'subscription_canceled'
));

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  product_key text not null,
  source text not null check (source in ('ixis', 'card')),
  status text not null check (status in ('active', 'past_due', 'canceled')),
  amount_ixis bigint not null check (amount_ixis > 0),
  renews_at timestamptz not null,
  cancel_at_period_end boolean not null default false,
  renew_attempt integer not null default 0 check (renew_attempt >= 0),
  stripe_subscription_id text,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_live_owner_product_uidx
  on public.subscriptions (owner_id, product_key)
  where status in ('active', 'past_due');

create unique index if not exists subscriptions_stripe_live_uidx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null and status in ('active', 'past_due');

create index if not exists subscriptions_ixis_due_idx
  on public.subscriptions (renews_at)
  where source = 'ixis' and status in ('active', 'past_due');

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from public, anon, authenticated;
grant select, insert, update on public.subscriptions to service_role;

-- Switching source cancels the other live row in the same transaction, so card and Ixis cannot both charge.
create or replace function public.enroll_subscription(
  p_owner_id uuid,
  p_product_key text,
  p_source text,
  p_amount bigint,
  p_renews_at timestamptz,
  p_stripe_subscription_id text default null,
  p_stripe_customer_id text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_owner_id is null or p_product_key is null or length(trim(p_product_key)) = 0 then
    raise exception 'subscription needs an owner and product' using errcode = 'WA400';
  end if;
  if p_source not in ('ixis', 'card') then
    raise exception 'subscription source must be ixis or card' using errcode = 'WA400';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'subscription amount must be positive' using errcode = 'WA400';
  end if;
  if p_renews_at is null then
    raise exception 'subscription needs renews_at' using errcode = 'WA400';
  end if;

  update public.subscriptions
     set status = 'canceled', updated_at = now()
   where owner_id = p_owner_id and product_key = p_product_key
     and status in ('active', 'past_due') and source <> p_source;

  select id into v_id from public.subscriptions
   where owner_id = p_owner_id and product_key = p_product_key
     and source = p_source and status in ('active', 'past_due')
   for update;

  if v_id is not null then
    update public.subscriptions
       set amount_ixis = p_amount, renews_at = p_renews_at, status = 'active',
           cancel_at_period_end = false,
           stripe_subscription_id = coalesce(p_stripe_subscription_id, stripe_subscription_id),
           stripe_customer_id = coalesce(p_stripe_customer_id, stripe_customer_id),
           updated_at = now()
     where id = v_id;
    return v_id;
  end if;

  insert into public.subscriptions (
    owner_id, product_key, source, status, amount_ixis, renews_at,
    stripe_subscription_id, stripe_customer_id
  ) values (
    p_owner_id, p_product_key, p_source, 'active', p_amount, p_renews_at,
    p_stripe_subscription_id, p_stripe_customer_id
  ) returning id into v_id;
  return v_id;
end $$;

create or replace function public.advance_subscription(
  p_id uuid, p_renews_at timestamptz, p_amount bigint
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.subscriptions
     set status = 'active', renews_at = p_renews_at, amount_ixis = p_amount,
         renew_attempt = 0, updated_at = now()
   where id = p_id and status in ('active', 'past_due')
   returning id into v_id;
  if v_id is null then raise exception 'subscription not found' using errcode = 'WA404'; end if;
  return v_id;
end $$;

create or replace function public.mark_subscription_past_due(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.subscriptions
     set status = 'past_due', updated_at = now()
   where id = p_id and status in ('active', 'past_due')
   returning id into v_id;
  if v_id is null then raise exception 'subscription not found' using errcode = 'WA404'; end if;
  return v_id;
end $$;

create or replace function public.bump_subscription_attempt(p_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare v_attempt integer;
begin
  update public.subscriptions
     set renew_attempt = renew_attempt + 1, updated_at = now()
   where id = p_id and status in ('active', 'past_due')
   returning renew_attempt into v_attempt;
  if v_attempt is null then raise exception 'subscription not found' using errcode = 'WA404'; end if;
  return v_attempt;
end $$;

create or replace function public.close_subscription(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.subscriptions
     set status = 'canceled', updated_at = now()
   where id = p_id and status in ('active', 'past_due')
   returning id into v_id;
  if v_id is null then raise exception 'subscription not found' using errcode = 'WA404'; end if;
  return v_id;
end $$;

create or replace function public.request_subscription_cancel(p_owner_id uuid, p_product_key text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.subscriptions
     set cancel_at_period_end = true, updated_at = now()
   where owner_id = p_owner_id and product_key = p_product_key and status in ('active', 'past_due')
   returning id into v_id;
  if v_id is null then raise exception 'subscription not found' using errcode = 'WA404'; end if;
  return v_id;
end $$;

create or replace function public.sync_card_subscription(
  p_stripe_subscription_id text,
  p_status text,
  p_cancel_at_period_end boolean,
  p_renews_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_status text;
begin
  if p_stripe_subscription_id is null or length(trim(p_stripe_subscription_id)) = 0 then
    raise exception 'stripe subscription id required' using errcode = 'WA400';
  end if;
  v_status := case
    when p_status in ('canceled', 'incomplete_expired') then 'canceled'
    when p_status in ('past_due', 'unpaid', 'incomplete') then 'past_due'
    else 'active'
  end;
  update public.subscriptions
     set status = v_status,
         cancel_at_period_end = coalesce(p_cancel_at_period_end, cancel_at_period_end),
         renews_at = coalesce(p_renews_at, renews_at),
         updated_at = now()
   where stripe_subscription_id = p_stripe_subscription_id
     and status in ('active', 'past_due')
   returning id into v_id;
  return v_id;
end $$;

do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in (
       'enroll_subscription', 'advance_subscription', 'mark_subscription_past_due',
       'bump_subscription_attempt', 'close_subscription', 'request_subscription_cancel',
       'sync_card_subscription'
     )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
