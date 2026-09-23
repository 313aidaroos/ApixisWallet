# Keys you must paste

I cannot invent Stripe or Supabase secrets. Auth and checkout stay dark until these are in Vercel → apixis-wallet → Settings → Environment Variables.

## Master login

- URL: `/login` → Master
- Email: `awad@apixis.dev`
- Password: the one **you** type on that screen (min 8). I will not set or store a password for you.

Turn **off** “Confirm email” in Supabase Auth if you want the password to work immediately.
Add `https://<wallet-domain>/auth/callback` to the Supabase redirect allow-list.

## Stripe (test first)

1. Stripe Dashboard → Developers → API keys → restricted key (Checkout only).
2. Products: Starter $100, Studio $500, Empire $1500. Copy Price IDs.
3. Webhook: `https://<wallet-domain>/api/webhooks/stripe` events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.closed`.
4. Paste (products: Spark $10, Starter $100, Studio $500, Empire $1500):
   - `STRIPE_RESTRICTED_KEY` (needs Checkout Sessions read/write + Charges/Disputes read)
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_IXIS_SPARK_PRICE_ID`
   - `STRIPE_IXIS_STARTER_PRICE_ID`
   - `STRIPE_IXIS_STUDIO_PRICE_ID`
   - `STRIPE_IXIS_EMPIRE_PRICE_ID`
   (the older `STRIPE_XP_*_PRICE_ID` names still work)

## Shared Supabase (same as Command)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `ALLOWED_EMAIL=awad@apixis.dev`

## Wallet backend

- `CRON_SECRET` — any long random string (Vercel Cron uses it for `/api/cron/release-holds`).
- `WALLET_ALLOW_LEGACY_SERVICE_KEY` — leave unset until every sister site has its own `apx_` key, then set `false` and rotate `SUPABASE_SECRET_KEY`.
- Sister-site keys: `npm run api-key -- --name <site> --apps <app>`; paste the printed SQL into Supabase, the key into that site's `WALLET_API_KEY`.

Full checklist: [AGENTS.md](../AGENTS.md) §8.
