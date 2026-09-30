# AI Change Log

## Rules for AI models, bots, and agents

If you are an AI (Claude, ChatGPT, Grok, Gemini, Copilot, Cursor, JunoAI, or any other model, bot, or agent) and you add, modify, or delete anything in this repository, you **must** append a dated entry to this file describing what you changed and why — one entry per work session, no exceptions. This log is how the repository owner tracks what every AI did. Human commits do not need entries.

Entry format:

## YYYY-MM-DD — <your name/model>
- Changed: <files or area>
- Why: <reason>

---

## 2026-09-28 — JunoAI
- Changed: created this file
- Why: owner's standing rule — every AI that touches this repo must log its changes here

## 2026-09-30 — Claude (family backend pass, branch claude/awesome-newton-3tygzi)
- Changed: `app/auth/callback/route.ts`, `sdk/apixis-login-next.ts` — `verifyOtp({ type: "email" })` instead of `"magiclink"` (D16).
- Changed: `lib/api/rate-limit.ts` (new) + `test/rate-limit.test.ts`; wired into `/api/v1/reservations`, `/api/v1/redeem`, `/api/sso/token` — burst protection per site key / per person (AGENTS.md §9).
- Changed: `scripts/create-family-keys.ts` — added halaxis, ominix, wattixis so every family site gets a Wallet key.
- Changed: `components/WalletScreen.tsx` — Tape tab no longer shows "Cap" / "24h vol" (POLICY.md: never market Ixis as an asset); absolute URL in `signInHere` to clear the Next lint warning.
- Changed: `AGENTS.md` §0c (decisions D11–D16 of 2026-09-30) and §9; new `docs/FAMILY_STATUS.md` — the single family status board (D15).
- Why: Awad's 2026-09-30 audit confirmation — put every AI on the same page, fix the fleet-wide sign-in bug at its source, and harden the money routes before testers.
- Changed (same session, later): `app/api/v1/marketplace/orders` + `.../[id]/settle`, `lib/api/marketplace.ts`, `test/marketplace.test.ts`, migration `011_marketplace_orders.sql` (30-day holds, `payout` audit type), `lib/audit.ts`, `sdk/apixis-wallet.ts` v3.1 (`marketplaceOrder`, `marketplaceSettle`), AGENTS.md §5.
- Why: D13 — Ominix (and later Rawixis) settle person-to-person orders through the one ledger with the 5% Apixis Bank fee, instead of a local NXC wallet. Migration 011 is NOT applied live yet; until then order holds are capped at 24 h by the live `reserve_xp`.
