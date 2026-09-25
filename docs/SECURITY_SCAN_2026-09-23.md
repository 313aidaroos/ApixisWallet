# Family Supabase security scan (2026-09-23)

A read-only scan of every Supabase project in the Apixis org. It used Supabase's security advisors plus targeted checks of table grants and function definitions. No customer rows were read. Fixes were applied only where the Status column says so.

| Project | Finding | Severity | Status |
|---|---|---|---|
| geoxis (`ncifprfgastofurrlsko`) | `public.admin_emails` had RLS off and INSERT open to anon/authenticated, so anyone could add themselves as admin. `is_admin_user()` gates tenants, assets, profiles and support tickets. Only 1 admin row existed (the owner's domain), so it was not abused. | Critical | **Fixed live:** RLS on, writes revoked from anon/authenticated, SELECT revoked from anon. Verified. |
| Lyrixis (`mkuvgkjakxkytscfvnkf`) | `public.magic_links` (email, token): RLS off, anon had full read/write, so login tokens could be stolen for account takeover. `public.support_tickets`: RLS off, anon could read, edit and delete every ticket. | Critical | **Fixed live:** `magic_links` locked to the service role. `support_tickets`: anyone may insert, signed-in users read only their own, no anon read/edit/delete. Post-fix check not yet run. If Lyrixis login reads `magic_links` with the anon key instead of the service key, that flow must move server-side. |
| recovra (`ewvgpfufzeyzyutjxuoh`) | `grant_plan_entitlement()` is callable by any signed-in org member. A user can create their own org and grant it any paid plan for 30 days, renewably, without paying through the Wallet. | High (revenue) | **Open.** Needs the Recovra repo to see who calls it. Fix: service-role only, plus server-side verification of the Wallet receipt. |
| recovra | `upsert_demo_audit_run()` and `create_support_request()` callable by anon | Low | Probably intended (demo and contact form). Add rate limiting. |
| Lyrixis | View `my_track_unlocks` is SECURITY DEFINER | Medium | Open: switch to `security_invoker = true`. |
| geoxis | View `current_asset_positions` is SECURITY DEFINER; `is_member()` and `is_admin_user()` executable by anon | Medium / Low | Open. |
| Socixis | `is_org_member()` executable by anon | Low | Open (helper; revoke from anon). |
| Contraxis, "313aidaroos's Project" (apixis / awad_command / qahwah / rawixis schemas) | `handle_new_user()` / `rls_auto_enable()` exposed via RPC; functions with a mutable `search_path`; `citext` installed in public | Low | Open. |
| halaxis (`zjlorazckuclrefcndxi`) | Not scanned (blocked by the assistant's safety filter before owner approval). | ? | Scan pending. |
| renoxis, deduxis, rawixis, launchixis, nurserytoons | Nothing exposed beyond deny-all tables | — | OK |
| All projects | Leaked-password protection is off | Medium | Owner: Supabase dashboard → Authentication → enable it on each project. |

"RLS enabled, no policy" (INFO) findings are deny-all tables. They're fine when only server code reads them.
