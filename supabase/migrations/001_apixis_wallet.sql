create extension if not exists pgcrypto;

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid,
  currency text not null default 'XP' check (currency = 'XP'),
  created_at timestamptz not null default now(),
  unique(owner_id, currency)
);

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  kind text not null check (kind in ('purchase','spend','refund','bonus','reserve','release','adjustment')),
  description text not null,
  app_slug text,
  created_at timestamptz not null default now()
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.ledger_transactions(id),
  wallet_id uuid not null references public.wallets(id),
  bucket text not null check (bucket in ('paid','bonus','reserved','clearing')),
  amount bigint not null check (amount <> 0),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  app_slug text not null,
  product_key text not null,
  status text not null default 'active' check (status in ('active','past_due','cancelled','expired')),
  renews_at timestamptz,
  xp_price bigint not null check (xp_price >= 0),
  created_at timestamptz not null default now(),
  unique(owner_id, app_slug, product_key)
);

alter table public.wallets enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.entitlements enable row level security;

create policy "owners read wallets" on public.wallets for select to authenticated using ((select auth.uid()) = owner_id);
create policy "owners read entries" on public.ledger_entries for select to authenticated using (exists (select 1 from public.wallets w where w.id = wallet_id and w.owner_id = (select auth.uid())));
create policy "owners read transactions" on public.ledger_transactions for select to authenticated using (exists (select 1 from public.ledger_entries e join public.wallets w on w.id=e.wallet_id where e.transaction_id=ledger_transactions.id and w.owner_id=(select auth.uid())));
create policy "owners read entitlements" on public.entitlements for select to authenticated using ((select auth.uid()) = owner_id);

create view public.wallet_balances with (security_invoker = true) as
select w.id as wallet_id, w.owner_id, coalesce(sum(e.amount) filter (where e.bucket in ('paid','bonus')),0)::bigint as available_xp, coalesce(sum(e.amount) filter (where e.bucket='reserved'),0)::bigint as reserved_xp
from public.wallets w left join public.ledger_entries e on e.wallet_id=w.id group by w.id,w.owner_id;

grant select on public.wallets, public.ledger_transactions, public.ledger_entries, public.entitlements, public.wallet_balances to authenticated;

-- Writes must happen server-side through a narrowly scoped service function/API.
-- Each transaction must sum to zero across customer and clearing wallets.
-- Use Stripe event IDs as external_id to make webhook processing idempotent.
