# Apixis Terms of Service — DRAFT for counsel

> **Status: draft written by Claude on 2026-10-02 from how the code actually works. Not published, not legal advice.**
> A lawyer must review it before it goes live (see "Questions for counsel" at the end). When the final text is published,
> bump `TERMS_VERSION` in Vercel (`apixis-wallet`) so the audit trail records which version each buyer accepted, and set
> the Terms URL in Stripe → Settings → Public details (then `STRIPE_REQUIRE_TERMS=true` makes checkout require consent).
> Placeholders: `[LEGAL ENTITY]`, `[ADDRESS]`, `[GOVERNING LAW]`, `[CONTACT EMAIL]`.

## 1. Who we are
These terms are an agreement between you and **[LEGAL ENTITY]** ("Apixis", "we"), [ADDRESS]. They cover the Apixis
Wallet and every Apixis family product that uses Apixis ID or Ixis: Apixis.dev, Renoxis, Socixis, Recovra, Deduxis,
Contraxis, Rawixis, Lyrixis, Halaxis, Launchixis, Geoxis, Nursery Toons, Ominix, Wattixis, Personal Content Bot and
Qahwah World (together, the "Services"). Some products have extra terms for their own features; where they conflict
with these terms on Ixis or payments, these terms win.

## 2. Apixis ID
- One account (Apixis ID) signs you in to every Apixis product. You sign in with a one-time email link or a password.
- You must be at least 18 (or the age of majority where you live) to buy Ixis. [Counsel: confirm minimum age for
  free use; Nursery Toons is aimed at families, so a parent/guardian rule may be needed.]
- Keep your email account secure. You are responsible for activity on your Apixis ID.
- We may suspend an account for fraud, abuse, chargebacks or breach of these terms.

## 3. Ixis
- **What Ixis is.** Ixis is Apixis platform credit. **100 Ixis = US$1** at purchase. You use Ixis to buy access,
  seats, unlocks and services inside Apixis products ("redeem").
- **Closed loop.** Ixis has no cash value outside the Services. It cannot be withdrawn, cashed out, sold, or sent
  to another person, except as part of a marketplace order described in section 6. Ixis is not money, a deposit,
  a security or an investment, and it earns no interest or yield.
- **No expiry.** Purchased Ixis does not expire.
- **One balance.** Your Ixis lives in one Wallet balance shared across every Apixis product.
- **Starter Ixis.** New Apixis IDs may receive in-world starter Ixis for the Apixis world (currently 1,000). Starter
  Ixis is promotional, has no cash value, and may be limited to in-world use.
- **Future plans.** We may in future offer a blockchain version of Ixis. Nothing is offered today, and any such
  offer would come with its own terms after legal review.

## 4. Buying Ixis
- Ixis is sold only in the Apixis Wallet, through Stripe Checkout. Stripe processes your card; we do not store card
  numbers.
- **All Ixis purchases are final and non-refundable.** Unused Ixis stays in your balance to spend.
- If a payment is reversed (refund issued by mistake, or a chargeback your bank decides against us), we remove the
  matching Ixis from your balance, even if that makes the balance negative, and may suspend the account until it is
  settled.
- Prices, taxes and the Ixis amount are shown before you pay.

## 5. Spending Ixis (redeeming)
- When you redeem, the product shows the Ixis price first. The Wallet places a hold, the product delivers, then the
  hold is captured (charged). If delivery fails, the hold is released and nothing is charged.
- **Monthly seats** last 30 days from purchase and stack if you renew early. One-time unlocks do not end.
- A captured redeem is final: you keep what you bought; Ixis are not returned.

## 6. Marketplace orders (Ominix and other person-to-person orders)
- Some products let one person pay another in Ixis for work or goods. The buyer's Ixis is held when the order is
  accepted, for up to 30 days.
- When the order is completed, the seller receives the order amount **minus the Apixis fee of 5%**.
- If the order is not completed, the hold is released back to the buyer.
- Apixis provides the platform and the payment ledger only. We are not a party to the agreement between buyer and
  seller and do not guarantee the work. [Counsel: dispute process, seller verification, tax reporting (1099-K/DAC7)
  if seller earnings ever become cash-redeemable.]

## 7. Card payments outside Ixis
Two products take card payments directly for physical goods, under their own checkout terms: **Qahwah World** (coffee)
and **Pinixis** (arcade builds and marketplace listings, with sellers paid through Stripe Connect). Those purchases
are not Ixis and follow those products' refund and delivery terms.

## 8. Cixy and AI features
Cixy and other AI features generate suggestions automatically. They can be wrong. They are not legal, financial, tax,
medical or religious advice. Check important information yourself. Do not put secrets you do not want processed by
our AI providers into chats.

## 9. Acceptable use
No fraud, money laundering, chargeback abuse, attempts to mint or move Ixis outside the Services, scraping, attacking
the Services, or illegal content. Our AI's recommendation rules (no gambling or adult content recommendations) are product
choices, not a limit on your lawful use.

## 10. Changes, availability and liability
- We may change the Services or these terms; we will show the new version and the date. Continued use after a change
  means you accept it. Ixis already in your balance keeps the rules in section 3.
- The Services are provided "as is". To the extent the law allows, our total liability to you is limited to the
  amount you paid us in the 12 months before the claim. [Counsel: consumer-law carve-outs.]
- If we ever shut down the Ixis system, we will give at least [90] days' notice to spend remaining Ixis.
  [Counsel: whether unredeemed balances trigger escheat / gift-card rules in any state.]

## 11. Law and contact
These terms are governed by [GOVERNING LAW]. Questions: [CONTACT EMAIL].

---

## Questions for counsel (from the code, not guesses)
1. **No-refund rule (D3)** vs EU/UK 14-day withdrawal rights and US state gift-card / stored-value laws.
2. Is closed-loop Ixis with a fixed peg and no expiry a "stored value" product needing a money-transmitter licence
   anywhere, given marketplace payouts between users (section 6)?
3. Negative balances after a lost chargeback: allowed to collect?
4. Minimum age, and Nursery Toons (children's content): COPPA / parental consent.
5. Promotional starter Ixis (1,000): any disclosure rules?
6. The future-blockchain sentence in section 3: keep or remove until a product exists?
