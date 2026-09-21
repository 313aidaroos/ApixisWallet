export type PackRef = { id: string; name: string; xp: number };

export type PackPurchase = {
  ownerId: string;
  amount: number;
  packName: string;
  description: string;
};

/** Ledger text for a paid pack. Status polling matches this string. */
export function packPurchaseDescription(packName: string) {
  return `${packName} pack`;
}

export type FulfillmentDecision =
  | { action: "credit"; purchase: PackPurchase }
  | { action: "refund"; purchase: PackPurchase; chargeId: string }
  | { action: "ignore"; reason: string }
  | { action: "reject"; error: string };

const OWNER_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SessionFields = {
  client_reference_id: string | null;
  metadata: { [key: string]: string } | null;
  payment_status?: string;
  mode?: string;
};

export function parsePackPurchase(
  clientReferenceId: string | null,
  metadata: { [key: string]: string } | null,
  packs: readonly PackRef[],
): { ok: true; purchase: PackPurchase } | { ok: false; error: string } {
  const ownerId = clientReferenceId?.trim() ?? "";
  if (!OWNER_UUID.test(ownerId)) {
    return { ok: false, error: "Checkout session is missing a valid owner" };
  }
  const packId = metadata?.pack_id ?? "";
  const pack = packs.find((item) => item.id === packId);
  if (!pack) return { ok: false, error: "Checkout session is missing a known Ixis pack" };
  if (metadata?.sku_type !== "ixis_pack") {
    return { ok: false, error: "Checkout session is not an Ixis pack" };
  }
  if (metadata.ixis !== String(pack.xp)) {
    return { ok: false, error: "Checkout session Ixis amount does not match the pack" };
  }
  const amount = Number(metadata.ixis);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, error: "Checkout session Ixis amount is invalid" };
  }
  return {
    ok: true,
    purchase: {
      ownerId,
      amount,
      packName: pack.name,
      description: packPurchaseDescription(pack.name),
    },
  };
}

export function decideCheckoutCredit(session: SessionFields, packs: readonly PackRef[]): FulfillmentDecision {
  if (session.mode && session.mode !== "payment") {
    return { action: "reject", error: "Checkout session is not a payment" };
  }
  if (session.payment_status !== "paid") {
    return { action: "ignore", reason: "payment_not_paid" };
  }
  const parsed = parsePackPurchase(session.client_reference_id, session.metadata, packs);
  if (!parsed.ok) return { action: "reject", error: parsed.error };
  return { action: "credit", purchase: parsed.purchase };
}

export function decideChargeRefund(
  charge: { id: string; refunded: boolean; amount: number; amount_refunded: number },
  session: SessionFields | null,
  packs: readonly PackRef[],
): FulfillmentDecision {
  if (!charge.refunded || charge.amount <= 0 || charge.amount_refunded !== charge.amount) {
    // Partial refunds are not prorated. refund_xp only sees this event, and a
    // cumulative amount_refunded would double-debit if applied again on retry.
    return { action: "ignore", reason: "partial_refund_not_applied" };
  }
  if (!session) return { action: "ignore", reason: "not_an_ixis_checkout" };
  const parsed = parsePackPurchase(session.client_reference_id, session.metadata, packs);
  if (!parsed.ok) return { action: "reject", error: parsed.error };
  return {
    action: "refund",
    chargeId: charge.id,
    purchase: {
      ...parsed.purchase,
      description: `Refund · ${parsed.purchase.packName} pack · ${charge.id}`,
    },
  };
}
