-- 012: one active Apixis ID client per name (2026-10-02).
--
-- /sso/authorize looks a client up by name with maybeSingle(); a second ACTIVE row with the same
-- name makes that lookup fail, which turns "Sign in with Apixis" into a 503 for that site.
-- Re-running scripts/create-family-keys.ts for a site that already has a key would do exactly that.
-- Inactive (retired) rows may share a name, so a key can be replaced: deactivate the old row, insert the new.
create unique index if not exists wallet_api_clients_active_name_idx
  on public.wallet_api_clients (name)
  where active;
