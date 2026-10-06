-- 015_receptionist_family_scope.sql — let the Apixis.dev engine sell the family AI Receptionist (D18).
-- 2026-10-06, Claude (family lead). Additive: adds the `family` app to Apixis.dev's Wallet key so it can
-- reserve `apixis.receptionist.monthly` (app Family). No other client, table or function changes.
-- Apply ONLY on Awad's go, after the catalog SKU is merged. Check first:
--   select name, app_slugs from public.wallet_api_clients where active and name = 'apixis';
-- Undo: update public.wallet_api_clients set app_slugs = array_remove(app_slugs, 'family') where active and name = 'apixis';

update public.wallet_api_clients
   set app_slugs = array_append(app_slugs, 'family')
 where active
   and name = 'apixis'
   and not ('family' = any(app_slugs));
