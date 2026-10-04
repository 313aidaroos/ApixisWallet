-- 014_world_orders.sql — terms for Apixis.dev in-world orders (world_trade / world_purchase).
-- 2026-10-04, Grok (Wallet Lead). Additive only: one new table, no function or existing table changed.
--
-- Apixis.dev in-world spending (agent deals, business offers, founding a business, in-world
-- purchases) moves onto the ONE shared Wallet through the existing marketplace hold path:
--   POST /api/v1/marketplace/orders  (reserve_xp hold on the buyer)
--   POST /api/v1/marketplace/orders/{id}/settle  (capture_xp, then settle_marketplace_payout)
--   POST /api/v1/reservations/{id}/release  (cancel)
-- Plain orders don't remember who the seller is or which kind they are. A world order must:
--   world_trade    agent → agent. Counterparty pinned when the order opens; settle pays ONLY that
--                  Apixis ID; fee locked at 500 bps (5%, floor).
--   world_purchase agent → the Apixis platform (a sink). Settle captures to clearing; nobody is paid.
-- This table is that memory, keyed by the hold's ledger external_id (`<app>:<idempotencyKey>`).
-- It never holds a balance and nothing here credits anyone: every Ixis still moves only through
-- reserve_xp / capture_xp / settle_marketplace_payout / release_xp.
--
-- Rollback (safe; world orders then answer 503 `world_orders_unavailable`, other orders unaffected):
--   drop table if exists public.marketplace_order_terms;

create table if not exists public.marketplace_order_terms (
  external_id text primary key,                         -- = ledger_transactions.external_id of the hold
  kind text not null check (kind in ('world_trade', 'world_purchase')),
  app_slug text not null,
  buyer_id uuid not null references auth.users(id),
  seller_id uuid references auth.users(id),             -- world_trade: the only payee; world_purchase: null
  fee_bps integer not null check (fee_bps between 0 and 10000),
  reference text check (reference is null or length(reference) <= 80),
  actor text,
  created_at timestamptz not null default now(),
  constraint marketplace_order_terms_seller_by_kind check ((kind = 'world_trade') = (seller_id is not null)),
  constraint marketplace_order_terms_no_self_trade check (seller_id is null or seller_id <> buyer_id)
);
create index if not exists marketplace_order_terms_buyer_idx on public.marketplace_order_terms (buyer_id, created_at desc);
create index if not exists marketplace_order_terms_seller_idx on public.marketplace_order_terms (seller_id, created_at desc) where seller_id is not null;

-- Service role only, insert + read. Terms are write-once (no update/delete grant): a retry with the
-- same key must match the first request or it is refused (409), like the ledger itself.
alter table public.marketplace_order_terms enable row level security;
revoke all on public.marketplace_order_terms from public, anon, authenticated, service_role;
grant select, insert on public.marketplace_order_terms to service_role;
