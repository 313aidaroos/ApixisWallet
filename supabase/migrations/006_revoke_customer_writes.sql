-- 006_revoke_customer_writes.sql
-- Defense in depth for the ledger. RLS + SELECT-only policies were the ONLY thing stopping a
-- customer from writing wallets / ledger_entries / ledger_transactions / entitlements: the roles
-- still held INSERT/UPDATE/DELETE grants (found live 2026-09-22). One dropped policy = open ledger.
-- All money writes go through SECURITY DEFINER functions (credit_xp/reserve_xp/capture_xp/release_xp)
-- or the service role, so customers never need table-level write.
revoke insert, update, delete, truncate, references, trigger on public.wallets, public.ledger_transactions, public.ledger_entries, public.entitlements from anon, authenticated;
revoke all on public.wallet_balances from anon, authenticated;
grant select on public.wallet_balances to authenticated;  -- view of own balance; RLS on base tables applies
-- also stop future tables in this schema inheriting write grants
alter default privileges in schema public revoke insert, update, delete on tables from anon, authenticated;
