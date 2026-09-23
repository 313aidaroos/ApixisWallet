import { termsVersion } from "@/lib/audit";

/**
 * What the customer sees and agrees to on Stripe Checkout. Policy (Awad, 2026-09-23):
 * Ixis purchases are final — no refunds — and Ixis never expire. Keep this text in line with the
 * published terms page, and bump TERMS_VERSION when that page changes.
 */
export const FINAL_SALE_NOTICE =
  "Ixis are Apixis platform credit (100 Ixis = $1), usable across Apixis products. Ixis never expire. " +
  "All Ixis purchases are final and non-refundable, and Ixis cannot be exchanged for cash.";

export function checkoutPolicyParams(pack: { name: string; xp: number }) {
  const params: {
    custom_text: { submit: { message: string } };
    consent_collection?: { terms_of_service: "required" };
    invoice_creation?: {
      enabled: true;
      invoice_data: { description: string; footer: string; metadata: Record<string, string> };
    };
  } = { custom_text: { submit: { message: FINAL_SALE_NOTICE } } };

  // Requires a Terms of Service URL in Stripe → Settings → Public details, or Stripe rejects the session.
  if (process.env.STRIPE_REQUIRE_TERMS === "true") {
    params.consent_collection = { terms_of_service: "required" };
  }
  // A real Stripe invoice (PDF, emailed, numbered). Stripe bills a small per-invoice fee for this.
  if (process.env.STRIPE_CREATE_INVOICES === "true") {
    params.invoice_creation = {
      enabled: true,
      invoice_data: {
        description: `${pack.name} pack · ${pack.xp.toLocaleString("en-US")} Ixis`,
        footer: FINAL_SALE_NOTICE,
        metadata: { sku_type: "ixis_pack", terms_version: termsVersion() },
      },
    };
  }
  return params;
}
