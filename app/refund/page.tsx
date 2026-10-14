import type { Metadata } from "next";
import { LegalDraft } from "@/components/LegalDraft";
import { LEGAL_CONTACT } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Refund Policy (draft) · Apixis Wallet",
  description: "Draft refund policy for Ixis. All sales are final. Pending counsel.",
};

export default function RefundPage() {
  return (
    <LegalDraft title="Refund Policy">
      <p>
        <strong>All Ixis sales are final.</strong> Apixis does not issue cash refunds for Ixis. Ixis cannot be withdrawn
        or exchanged for cash. Unused Ixis stays in your Wallet to spend. Contact: {LEGAL_CONTACT}.
      </p>
      <h2>If a charge is reversed</h2>
      <p>
        If Stripe refunds a charge anyway, or your bank wins a chargeback, Apixis removes the matching Ixis from the
        paid balance. That can make the balance negative, and redeems stay blocked until you buy Ixis again. Partial
        refunds are not applied to the ledger automatically. They are logged for a person to handle.
      </p>
      <h2>Holds that were not captured</h2>
      <p>
        A released hold was not charged. Those Ixis return to the balance they came from. A captured hold was charged.
        Access from a captured seat is not taken away because a later renewal failed.
      </p>
      <h2>Monthly seats</h2>
      <p>
        You can cancel a monthly seat before the next renewal. The current 30 days stay. The next renewal is not
        charged. Canceling does not refund the period you already paid.
      </p>
      <h2>Marketplace orders</h2>
      <p>
        If an order is not completed, the buyer’s hold is released. A completed order pays the seller minus the 5%
        Apixis fee. That fee is not a cash refund path.
      </p>
      <h2>Physical goods</h2>
      <p>
        Coffee bought on Qahwah World, and Pinixis arcade builds or listings paid by card, follow those products’ own
        delivery terms. They are not Ixis purchases.
      </p>
      <p>Counsel still needs to confirm EU/UK withdrawal rights and US state gift-card rules before this page is final.</p>
    </LegalDraft>
  );
}
