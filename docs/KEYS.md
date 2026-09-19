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
3. Webhook: `https://<wallet-domain>/api/webhooks/stripe` events `checkout.session.completed`.
4. Paste:
   - `STRIPE_RESTRICTED_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_XP_AGENT_PRICE_ID`
   - `STRIPE_XP_OFFICE_PRICE_ID`
   - `STRIPE_XP_BUSINESS_PRICE_ID`

## Shared Supabase (same as Command)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `ALLOWED_EMAIL=awad@apixis.dev`
