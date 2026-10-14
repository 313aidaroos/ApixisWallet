import type { Metadata } from "next";
import { LegalDraft } from "@/components/LegalDraft";
import { LEGAL_CONTACT, LEGAL_ENTITY_PLACEHOLDER } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service (draft) · Apixis Wallet",
  description: "Draft terms for Apixis Wallet and Ixis. Pending counsel.",
};

export default function TermsPage() {
  return (
    <LegalDraft title="Terms of Service">
      <p>
        These terms are a draft agreement between you and {LEGAL_ENTITY_PLACEHOLDER} (“Apixis”). They cover the Apixis
        Wallet and every Apixis family product that uses Apixis ID or Ixis. Where a product’s own terms disagree about
        Ixis or payments, these terms win. Contact: {LEGAL_CONTACT}.
      </p>
      <h2>Apixis ID</h2>
      <p>
        One Apixis ID signs you in to every Apixis product. New accounts are created here, as an Apixis ID. You must be
        at least 18, or the age of majority where you live, to buy Ixis. You are responsible for activity on your account.
      </p>
      <h2>Ixis</h2>
      <p>
        Ixis is Apixis platform credit. <strong>100 Ixis = US$1</strong> at purchase. You spend Ixis inside Apixis
        products. Purchased Ixis does not expire. One Wallet balance is shared across every product. Ixis cannot be
        withdrawn, cashed out, sold, or sent to another person, except a marketplace order described below. Ixis is not
        money, a deposit, a security, or an investment, and it earns no interest.
      </p>
      <h2>Buying Ixis</h2>
      <p>
        Dollars for Ixis are paid only in this Wallet, through Stripe. Apixis does not store card numbers.{" "}
        <strong>All Ixis purchases are final.</strong> There is no cash refund. If a bank reverses a charge, Apixis
        removes the matching Ixis, even if that makes the balance negative.
      </p>
      <h2>Spending Ixis</h2>
      <p>
        A redeem places a hold, the product delivers, then the hold is captured. If delivery fails, the hold is released
        and nothing is charged. A captured redeem is final. Monthly seats last 30 days and can renew. One-time unlocks
        do not end. Catalog redeems are not charged the marketplace fee.
      </p>
      <h2>Marketplace and world orders</h2>
      <p>
        Some products let one person pay another in Ixis. When the order completes, the seller receives the amount minus
        the Apixis fee of <strong>5%</strong>. That 5% fee applies to marketplace orders and in-world trades. It does not
        apply to buying Ixis packs or to redeeming a catalog seat. If an order is not completed, the hold goes back to
        the buyer. Apixis is not a party to the agreement between buyer and seller.
      </p>
      <h2>Cards outside Ixis</h2>
      <p>
        Qahwah World (coffee) and Pinixis (arcade builds and marketplace listings) take card payments on their own Stripe
        accounts for physical goods. Those purchases are not Ixis.
      </p>
      <p>The longer working draft for counsel is in the repository at docs/legal/TERMS_DRAFT.md. It is not published as final text.</p>
    </LegalDraft>
  );
}
