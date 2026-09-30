Grok Bot (Developer Bot hub + product leads) notes. Every change Grok Bot makes to this product (code, env, database, deploys) gets a dated entry here so Claude, Hermes and Codex stay on the same page.

## 2026-09-27 (CT) — Developer Bot (hub)
- Wallet database: added 12 client rows in Supabase project `kzneeksminozmhnqaaun`, all with `require_sso=false`.
- Vercel: added `CHECKOUT_RETURN_HOSTS=spatial-dashboard-xi.vercel.app` and redeployed; no secret value is recorded here.
- Code note: `lib/checkout/return-url.ts` still lists `socixis.vercel.app` and `geoxis.vercel.app`; this was not fixed.
- Unapplied script patch: `/workspace/hubops/create-family-keys.fix.patch` updates family-site domain handling, adds Halaxis, uses Geoxis `spatial-dashboard-xi.vercel.app` plus extra callback paths, and supports `--only` for already-registered names; it remains unapplied and was not committed.
- Vercel name-only check: `WALLET_STATS_KEY` is missing on `apixis-wallet`.
- Undo: remove the added return-host setting and deactivate the 12 client rows; leave the code and patch unchanged.

## 2026-09-28 (CT) — Grok Developer Bot: Apixis ID sign-in fixes (PRs #16, #17, #18) + migration 010
- #16 (`ff5797b`) login honours `next`: `login`/`signup`/`magicLink`/`setPassword` return a same-origin `redirectTo` (via `safeLocalRedirect`), pages do a full navigation so `/sso/authorize` isn't fetched by the RSC router; `/auth/callback` skips `/set-password` when `user_metadata.password_set`. Test: `test/login-next.test.ts`. Undo: `git revert ff5797b`.
- #17 (`85a3930`) CheckoutSuccess always shows "Back to Wallet" and "Back to <product>" (stored, allowlisted `return_url` read server-side from the Stripe session via `/api/checkout/return?…&to=product`). No Stripe keys/prices/config touched. Test: `test/checkout-back-link.test.ts`. Undo: `git revert 85a3930`.
- #18 (`b7ce1ae`) release-holds cron 500 (duplicate `ledger_transactions_external_id_key`) fixed with migration `010_idempotent_hold_release.sql` (function bodies only; legacy settlements recognised, no double credit, per-hold `unique_violation` caught). Test: `supabase/tests/40_hold_release_test.sql`.
- Database: migration 010 applied to Supabase `kzneeksminozmhnqaaun` on 2026-09-28 00:52:50 CT (migration version 20260928055250).
- Undo for #18/010: `git revert b7ce1ae`, then re-run the four function definitions from `007_launch_hardening.sql` on `kzneeksminozmhnqaaun`.

## 2026-09-28 (CT) — Grok Developer Bot: /login "Log in with Apixis ID" + Forgot password (PR #19, squash 95f7764)
- What: `/login` heading/button "Log in with Apixis ID", Magic link / Password tabs (`?mode=` deep links), "Forgot password?" → `resetPassword` server action → "Check your email"; Create account and Master kept. `/set-password?reset=1` reads the recovery hash, `startRecovery` sets the session cookie, `setPassword` saves and continues to `next`; expired links offer "Email me a new reset link".
- Header: `components/AuthShell.tsx` (Wallet brand mark + HQ / Buy Ixis / Apixis.dev nav) and a Cixy help card (official Combo A avatar `public/cixy/cixy-combo-a-avatar.webp`, 3 FAQ answers, "Ask Cixy ↗" → https://apixis.dev/login#ask-cixy). It is a `<section>`, not `<aside>` (globals.css styles `aside` as the HQ sidebar). The Wallet has no public Cixy chat of its own yet.
- Where: `app/login/page.tsx`, `app/login/actions.ts`, `app/set-password/page.tsx`, `components/AuthShell.tsx`, `lib/auth-reset.ts`, `app/globals.css` (auth-* rules appended only), `public/cixy/`, `test/auth-reset.test.ts`. No checkout/Stripe.
- Deploy: `dpl_7XmDng6KGC9NWW2FDV6uitqTqxu9` READY. Reset verified live end-to-end from apixis.dev (redirect to `/set-password` is allowed in Supabase Auth). Test user grok-apixis-1790575604@uberip.com (6f5eb1c6-b433-4d2b-8fbe-9a12a39cf7be) was created for that; safe to delete.
- Undo: `git revert 95f7764d79b893c6cf288651e143a2d6249f2784`.


## 2026-09-29 (CT) — Grok (Wallet Lead): Wallet footer "Other Ixis companies"
- What: the Wallet footer (the "APIXIS FAMILY CO. · coins only · peg…" line) now has a second line, "Other Ixis companies:", with 11 plain text links that open in a new tab (`target="_blank" rel="noopener noreferrer"`): Apixis, Socixis, Renoxis, Rawixis, Contraxis, Lyrixis, Halaxis, Recovra, Deduxis, Geoxis, Wattixis. Apixis Wallet itself is left out; Qahwah World and Nursery Toons were removed at Awad's request (2026-09-29); Nexxis/Omnixis, Launchixis, PersonalContentBot, AwadBot and COMMAND are not included. Approved by Awad 2026-09-29 as a one-off exception to the credit pause.
- Where: `lib/ixis-companies.ts` (the only place the names/URLs live — swap URLs there when custom domains arrive), `components/WalletScreen.tsx` (footer markup only), `app/globals.css` (appended `.ixis-others` rules: links inherit the muted 10px footer text and wrap on mobile). The CheckoutSuccess footer was intentionally not touched (checkout code is out of scope).
- Who: Grok / Wallet Lead. Branch `grok/footer-other-ixis`, PR against main; not merged, not deployed to production.
- Undo: revert the PR commit (`git revert <sha>`), or delete the `.ixis-others` block from the WalletScreen footer, the `.ixis-others` CSS rules, and `lib/ixis-companies.ts`.
