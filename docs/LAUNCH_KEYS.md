# Launch morning: keys and codes (Awad's checklist)

All the code is built, tested and waiting in pull requests. This page is everything left: paste the keys, then merge. Work top to bottom. Each step says where to click.

> Never paste a key into GitHub, chat or a document. Keys only go into Vercel or the Supabase SQL editor.

---

## Step 1: Wallet database (Supabase → project **apixis-wallet** → SQL Editor)

1. Run `supabase/migrations/009_apixis_id.sql` (copy its whole contents, paste, click **Run**). This adds the shared Apixis login. Migrations 007 and 008 are already live.
   *If Claude has the Supabase connector at that moment, Claude runs this for you.*
2. **Authentication → Passwords / Security:** turn on **Leaked password protection**. Do this for every project in the list.
3. **Authentication → Providers → Email:** keep **Confirm email** ON.

## Step 2: Wallet on Vercel (project **apixis-wallet** → Settings → Environment Variables → Production)

| Name | Value |
|---|---|
| `CRON_SECRET` | any long random password (e.g. from a password manager) |
| `TERMS_VERSION` | `2026-09-23` |

Leave `WALLET_ALLOW_LEGACY_SERVICE_KEY` unset for now (see Step 6).

## Step 3: Stripe (dashboard → Developers → Webhooks → the Wallet endpoint)

Make sure these events are ticked:
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `charge.refunded`
- `charge.dispute.closed`

Optional: Settings → Customer emails → turn on **Successful payments** (free receipts).

## Step 4: Make every site's key, one command

On any computer with this repo:
```bash
npm install
npm run family-keys
```
It prints two things:
1. **One SQL block.** Paste it into the **apixis-wallet** Supabase SQL Editor and click Run. That registers every site, and its sign-in callback, with the Wallet.
2. **An env block per site.** Paste each block into that site's Vercel project → Settings → Environment Variables → Production.

The keys are shown once. If you lose one, run the command again. Before re-running, deactivate the old keys:
`update public.wallet_api_clients set active = false where name = '<site>';`

**Check the domains first.** The command uses the hosts in `scripts/create-family-keys.ts`. If a site lives somewhere else, edit that line before running:

| Site | Domain |
|---|---|
| renoxis | renoxis.dev |
| socixis | socixis.dev |
| recovra | recovra-three.vercel.app |
| lyrixis | lyrixis.vercel.app |
| rawixis | rawixis.vercel.app |
| contraxis | contraxis-dev.vercel.app |
| geoxis | geoxis.vercel.app |
| launchixis | launchixis.vercel.app |
| nurserytoons | nurserytoons.vercel.app |
| qahwahworld | qahwahworld.vercel.app |
| contentbot | personalcontentbot.vercel.app |
| deduxis | deduxis.vercel.app |
| apixis | apixis.dev |

If a site has a custom domain the Wallet doesn't know yet, also add it to the Wallet's Vercel env as `CHECKOUT_RETURN_HOSTS` (comma-separated). That way "Buy Ixis" can send people back there.

## Step 5: One extra key on some sites (each site's own Supabase)

"Sign in with Apixis" needs each site's **own** Supabase service key on its server.
- **Where to find it:** Supabase → that site's project → Settings → API → `service_role` secret.
- **Where it goes:** that site's Vercel project, as `SUPABASE_SERVICE_ROLE_KEY`.
- **Needed on:** Recovra and Lyrixis. They didn't have it before.
- **Probably already set on:** Renoxis, Rawixis, Socixis and Contraxis. Check.

## Step 6: Merge (in this order)

1. **ApixisWallet** PR: the Wallet side (after Step 1).
2. Each site's PR, each titled "Sign in with Apixis + shared Apixis Wallet":
   - Renoxis #18
   - Socixis #32
   - Recovra #4 (merge **together with** running its migration `20260923000001_plan_entitlement_service_only.sql` on the recovra Supabase project)
   - Lyrixis #6
   - Rawixis #15
   - Contraxis #22
3. Redeploy each site in Vercel if it doesn't redeploy automatically.

**Once every site works with its own key:**
- set `WALLET_ALLOW_LEGACY_SERVICE_KEY=false` on the Wallet
- rotate the Wallet's Supabase `service_role` key (Supabase → apixis-wallet → Settings → API). The old one was shared with every site.

## Step 7: Five-minute test (Stripe **test mode** first)

1. Open a sister site → **Sign in with Apixis** → you land back signed in.
2. Click **Buy Ixis** → buy the Spark pack with Stripe's test card `4242 4242 4242 4242` → you come back to the site, and the balance shows 1,000 Ixis.
3. Redeem something on that site → the balance drops, and the site unlocks it.
4. On the Wallet, open `/api/admin/audit?format=csv` (signed in as awad@apixis.dev) → you see the purchase and the redeem with reference numbers.

When all four work, switch Stripe to live keys.
