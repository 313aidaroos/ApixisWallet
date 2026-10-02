# Apixis Privacy Policy — DRAFT for counsel

> **Status: draft written by Claude on 2026-10-02 from what the code actually collects. Not published, not legal advice.**
> Counsel must review before publishing (GDPR/UK GDPR, CCPA/CPRA, COPPA for Nursery Toons). Placeholders:
> `[LEGAL ENTITY]`, `[ADDRESS]`, `[CONTACT EMAIL]`, `[RETENTION PERIODS]`.

## 1. Who is responsible
**[LEGAL ENTITY]**, [ADDRESS], runs Apixis ID, the Apixis Wallet and the Apixis family products listed in the Terms.
Contact: [CONTACT EMAIL].

## 2. What we collect
| Data | Where it comes from | Why |
|---|---|---|
| Email address, Apixis ID (account number), display name | You, when you sign in | Your account; signing you in to every Apixis product |
| Password (stored only as a hash by our auth provider), one-time sign-in links | You | Security |
| Wallet records: Ixis purchases, holds, redeems, marketplace orders and payouts, balance | Your activity | Running the ledger; legal/financial record keeping |
| Purchase records: Stripe payment/checkout ids, terms version accepted, the price and notice shown, time, **IP address and browser user agent** | Checkout and redeem requests | Proof of purchase, fraud prevention, disputes and chargebacks |
| Card details | Entered on Stripe's page | Processed by Stripe; **we never see or store card numbers** |
| What you create in a product (drafts, listings, receipts and photos you upload to Deduxis, songs you upload to Lyrixis, contracts/briefs, comments, posts) | You | Providing that product |
| Chats with Cixy and other AI features | You | Answering you; sent to our AI providers (section 4) |
| Location you type into a listing (city/ZIP; Ominix rounds map coordinates to about 1 km) | You | Local search |
| Connected accounts you choose to link (Google for Renoxis, Meta for Socixis) | You, via OAuth | Only the features you turned on; tokens stored encrypted |
| Server logs (IP, pages requested, errors) | Our hosting | Security and fixing problems |

We do not sell personal information and do not use advertising trackers in the products' backend. [Counsel/owner:
confirm no analytics pixels are added on the front end.]

## 3. Cookies and similar
Sign-in cookies (session, and a short-lived `apixis_login` state cookie during sign-in) are strictly necessary.
Some products keep drafts in your browser's local storage until you save them to your account.

## 4. Who processes data for us
| Provider | What for |
|---|---|
| Supabase | Database, authentication, file storage (each product has its own project; the Wallet has its own) |
| Vercel | Hosting, server logs |
| Stripe | Card payments for Ixis (Wallet), coffee (Qahwah World) and Pinixis; Stripe Connect for Pinixis sellers |
| Resend | Sending emails (sign-in links, receipts, support replies) |
| Anthropic (Claude) — fallback providers OpenAI and xAI on some products | AI answers (Cixy and product AI features) |
| Optional, only where that feature is on: Upstash/Redis (queues and world state), a speech-to-text provider (Lyrixis), Tavily (Halaxis research), HeyGen / D-ID / Runway / Replicate (Socixis video), Google and Meta (account connections you choose) | That feature only |

Providers may process data outside your country (mainly the United States) under their own safeguards.
[Counsel: SCCs / DPAs list.]

## 5. How long we keep it
- Account data: while your account is open, then deleted or anonymised within [RETENTION PERIODS].
- Wallet and purchase records: kept for [7 years] for tax, accounting and dispute reasons, even after account
  closure (the ledger is append-only by design).
- Product content: until you delete it or close the account.
- Logs: [30–90 days].

## 6. Your rights
You can ask to access, correct, export or delete your data, or object to processing, by emailing [CONTACT EMAIL].
Wallet purchase records may be kept where the law requires (section 5). California residents: we do not sell or
share personal information for cross-context advertising. EU/UK residents: you may complain to your data protection
authority.

## 7. Children
The Services are not directed to children under 13 [counsel: 16 in some EU countries]. Nursery Toons is content for
families and is meant to be used by a parent or guardian. Buying Ixis requires an adult.

## 8. Security
Money functions in the database are callable only by our servers; each product has its own database and keys; per-site
Wallet keys are stored only as hashes; secrets never go to the browser. No system is perfectly secure; tell us at
[CONTACT EMAIL] if you find a problem.

## 9. Changes
We will post the updated policy with its date and, for material changes, tell you by email or in the product.
