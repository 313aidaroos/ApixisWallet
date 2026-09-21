import type { SupabaseClient } from "@supabase/supabase-js";
import type { PackPurchase } from "@/lib/stripe/fulfillment";

export async function creditPaidPack(supabase: SupabaseClient, eventId: string, purchase: PackPurchase) {
  const { data, error } = await supabase.rpc("credit_xp", {
    p_owner_id: purchase.ownerId,
    p_amount: purchase.amount,
    p_bucket: "paid",
    p_description: purchase.description,
    p_external_id: eventId,
  });
  if (error) throw error;
  return data;
}

export async function refundPaidPack(supabase: SupabaseClient, eventId: string, purchase: PackPurchase) {
  const { data, error } = await supabase.rpc("refund_xp", {
    p_owner_id: purchase.ownerId,
    p_amount: purchase.amount,
    p_description: purchase.description,
    p_external_id: eventId,
  });
  if (error) throw error;
  return data;
}

export async function findRefundForCharge(supabase: SupabaseClient, chargeId: string) {
  const pattern = `%${chargeId.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const { data, error } = await supabase
    .from("ledger_transactions")
    .select("id")
    .eq("kind", "refund")
    .like("description", pattern)
    .limit(1);
  if (error) throw error;
  return data?.[0]?.id ?? null;
}
