import type { Metadata } from "next";
import { LegalDraft } from "@/components/LegalDraft";
import { LEGAL_CONTACT, LEGAL_ENTITY_PLACEHOLDER } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy (draft) · Apixis Wallet",
  description: "Draft privacy policy for Apixis Wallet. Pending counsel.",
};

export default function PrivacyPage() {
  return (
    <LegalDraft title="Privacy Policy">
      <p>
        {LEGAL_ENTITY_PLACEHOLDER} runs Apixis ID and the Apixis Wallet. Contact: {LEGAL_CONTACT}. This draft describes
        what the Wallet code collects. Counsel must review it before it is final, including GDPR, UK GDPR, CCPA, and
        family-product rules for Nursery Toons.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Email address and Apixis ID, so you can sign in.</li>
        <li>Wallet records: purchases, holds, redeems, marketplace orders, and your balance.</li>
        <li>
          Checkout records: Stripe payment ids, the price shown, the terms version, time, IP address, and browser user
          agent. These are kept for fraud, tax, and legal records.
        </li>
        <li>Card numbers are entered on Stripe’s page. Apixis does not store them.</li>
      </ul>
      <h2>Why</h2>
      <p>
        To run the ledger, sign you in, prevent fraud, and keep the legal record of each transaction. We do not sell
        personal information.
      </p>
      <h2>Who processes it</h2>
      <p>
        Supabase stores the ledger and accounts. Vercel hosts the site. Stripe processes card payments. Sign-in email
        may be sent by the auth provider. Product content you create lives in that product, not in this policy’s detail.
      </p>
      <h2>Cookies</h2>
      <p>Sign-in cookies are strictly necessary. They keep you signed in to the Wallet.</p>
      <p>The longer working draft for counsel is in the repository at docs/legal/PRIVACY_DRAFT.md.</p>
    </LegalDraft>
  );
}
