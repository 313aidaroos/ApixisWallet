-- 008_audit_log.sql
-- Legal record of every money event. Safe to re-run. Apply after 007.
--
-- The ledger (ledger_transactions / ledger_entries) is the accounting truth: every Ixis movement,
-- balanced and append-only. audit_events is the EVIDENCE around each movement: who, when, from which
-- site and IP, what they were shown (price, terms version), and the Stripe ids (session, payment,
-- charge, invoice, receipt URL) needed to answer a dispute, a tax question or a legal request.
--
-- Rules:
--  * Append-only. No UPDATE / DELETE / TRUNCATE, for anyone (trigger).
--  * service_role only. Customers and anon can't read or write it.
--  * Every row gets a human reference number: APX-00000001, APX-00000002, … (quote it to customers).
--  * dedupe_key makes writes idempotent (a retried webhook doesn't create a second row).
--  * Times are timestamptz (UTC). Money: amount_ixis (integer) + amount_cents / currency for cash.

begin;

create sequence if not exists public.audit_reference_seq;

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  reference text not null unique default ('APX-' || lpad(nextval('public.audit_reference_seq')::text, 8, '0')),
  occurred_at timestamptz not null default now(),
  event_type text not null check (event_type in (
    'checkout_started',   -- customer opened Stripe Checkout (what they were shown)
    'purchase',           -- Stripe paid → Ixis credited
    'refund',             -- cash refunded in Stripe → Ixis removed
    'dispute_lost',       -- chargeback lost → Ixis removed
    'reserve',            -- a site put Ixis on hold for a product
    'capture',            -- the hold was spent (sale of the product)
    'release',            -- the hold was returned (no sale)
    'redeem',             -- in-Wallet purchase (hold + spend in one step)
    'hold_expiry_sweep'   -- cron released expired holds
  )),
  dedupe_key text unique,
  actor text,                          -- 'stripe', 'wallet-ui', 'key:renoxis', 'legacy-service-key', 'cron'
  app_slug text,                       -- site the event belongs to
  owner_id uuid,                       -- Wallet user id
  owner_email text,                    -- email at the time of the event
  ledger_transaction_id uuid,          -- ledger row this event produced (receipt id)
  reservation_id uuid,
  product_key text,
  amount_ixis bigint,
  amount_cents bigint,                 -- cash amount, for Stripe events
  currency text,
  stripe_event_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_invoice_id text,
  stripe_receipt_url text,
  terms_version text,                  -- TERMS_VERSION shown/accepted at checkout
  ip_address text,
  user_agent text,
  request_id text,                     -- x-vercel-id, for matching platform logs
  outcome text not null default 'ok',  -- 'ok' | 'rejected' | 'failed'
  details jsonb not null default '{}'::jsonb
);

create index if not exists audit_events_occurred_idx on public.audit_events (occurred_at desc);
create index if not exists audit_events_owner_idx on public.audit_events (owner_id, occurred_at desc);
create index if not exists audit_events_email_idx on public.audit_events (lower(owner_email), occurred_at desc);
create index if not exists audit_events_type_idx on public.audit_events (event_type, occurred_at desc);
create index if not exists audit_events_ledger_tx_idx on public.audit_events (ledger_transaction_id);
create index if not exists audit_events_stripe_session_idx on public.audit_events (stripe_checkout_session_id);

alter table public.audit_events enable row level security;
revoke all on public.audit_events from public, anon, authenticated;
revoke all on sequence public.audit_reference_seq from public, anon, authenticated;
revoke update, delete, truncate on public.audit_events from service_role;
grant select, insert on public.audit_events to service_role;
grant usage on sequence public.audit_reference_seq to service_role;

drop trigger if exists audit_events_append_only on public.audit_events;
create trigger audit_events_append_only before update or delete on public.audit_events
  for each row execute function public.ledger_append_only();
drop trigger if exists audit_events_no_truncate on public.audit_events;
create trigger audit_events_no_truncate before truncate on public.audit_events
  for each statement execute function public.ledger_append_only();

commit;
