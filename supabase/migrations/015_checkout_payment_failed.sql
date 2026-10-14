-- 015_checkout_payment_failed.sql
-- Records a delayed Checkout payment that failed, so /buy/complete can leave "pending".
-- Safe to re-run. Does not move Ixis. Apply after 013.
-- If a later migration already widened this check (subscription events), leave that check in place.

begin;

do $$
declare def text;
begin
  select pg_get_constraintdef(oid) into def
  from pg_constraint
  where conname = 'audit_events_event_type_check'
    and conrelid = 'public.audit_events'::regclass;
  if def is not null and def like '%subscription_renewed%' then
    return;
  end if;
  alter table public.audit_events drop constraint if exists audit_events_event_type_check;
  alter table public.audit_events add constraint audit_events_event_type_check check (event_type in (
    'checkout_started', 'purchase', 'refund', 'dispute_lost', 'reserve', 'capture', 'release', 'redeem',
    'hold_expiry_sweep',
    'payout',
    'signup_grant',
    'signup_grant_revoke',
    'checkout_payment_failed'
  ));
end $$;

commit;
