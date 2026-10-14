import type { SupabaseClient } from "@supabase/supabase-js";
import { findCatalogProduct } from "@/lib/catalog";
import { ledgerIdempotencyKey, productApp } from "@/lib/api/reserve";
import { recordAudit } from "@/lib/audit";
import { addDays, ixisRenewKey, planIxisRenewal } from "@/lib/subscriptions";

type DueRow = {
  id: string;
  owner_id: string;
  product_key: string;
  source: string;
  status: string;
  renews_at: string;
  cancel_at_period_end: boolean;
  renew_attempt: number;
};

function rpcCode(error: { code?: string; message?: string } | null) {
  return error?.code ?? "";
}

async function reserveSeat(
  supabase: SupabaseClient,
  row: DueRow,
  amount: number,
  days: number,
  app: string,
  attempt: number,
) {
  const renewsAt = new Date(row.renews_at);
  return supabase.rpc("reserve_xp", {
    p_owner_id: row.owner_id,
    p_amount: amount,
    p_description: `Monthly renewal ${row.product_key}`,
    p_external_id: ledgerIdempotencyKey(app, ixisRenewKey(row.id, renewsAt, attempt)),
    p_app_slug: app,
    p_product_key: row.product_key,
    p_actor: "cron:renew",
    p_entitlement_days: days,
    p_hold_seconds: 86400,
  });
}

/** Spend one due Ixis seat. A short balance becomes past_due and does not remove the current period. */
export async function renewIxisSubscription(supabase: SupabaseClient, row: DueRow, now = new Date()) {
  const plan = planIxisRenewal({
    source: row.source,
    status: row.status,
    renewsAt: new Date(row.renews_at),
    cancelAtPeriodEnd: row.cancel_at_period_end,
    now,
  });
  if (plan === "skip") return "skip" as const;
  if (plan === "cancel") {
    const closed = await supabase.rpc("close_subscription", { p_id: row.id });
    if (closed.error) throw closed.error;
    await recordAudit(supabase, {
      event_type: "subscription_canceled",
      dedupe_key: `subscription_canceled:${row.id}:${new Date(row.renews_at).toISOString().slice(0, 10)}`,
      actor: "cron:renew",
      owner_id: row.owner_id,
      product_key: row.product_key,
      outcome: "ok",
      details: { reason: "cancel_at_period_end" },
    });
    return "canceled" as const;
  }

  const product = findCatalogProduct(row.product_key);
  if (!product || !("days" in product) || typeof product.days !== "number") {
    const closed = await supabase.rpc("close_subscription", { p_id: row.id });
    if (closed.error) throw closed.error;
    await recordAudit(supabase, {
      event_type: "subscription_canceled",
      dedupe_key: `subscription_canceled:${row.id}:sku`,
      actor: "cron:renew",
      owner_id: row.owner_id,
      product_key: row.product_key,
      outcome: "failed",
      details: { reason: "sku_removed" },
    });
    return "canceled" as const;
  }

  const app = productApp(product);
  let attempt = row.renew_attempt ?? 0;
  let held = await reserveSeat(supabase, row, product.xp, product.days, app, attempt);
  if (rpcCode(held.error) === "WA409") {
    const bumped = await supabase.rpc("bump_subscription_attempt", { p_id: row.id });
    if (bumped.error) throw bumped.error;
    attempt = Number(bumped.data);
    held = await reserveSeat(supabase, row, product.xp, product.days, app, attempt);
  }
  if (rpcCode(held.error) === "WA402" || (held.error?.message ?? "").includes("Insufficient")) {
    const marked = await supabase.rpc("mark_subscription_past_due", { p_id: row.id });
    if (marked.error) throw marked.error;
    await recordAudit(supabase, {
      event_type: "subscription_past_due",
      dedupe_key: `subscription_past_due:${row.id}:${new Date(row.renews_at).toISOString().slice(0, 10)}`,
      actor: "cron:renew",
      owner_id: row.owner_id,
      product_key: row.product_key,
      amount_ixis: product.xp,
      outcome: "failed",
      details: { reason: "insufficient" },
    });
    return "past_due" as const;
  }
  if (held.error) throw held.error;

  const captured = await supabase.rpc("capture_xp", {
    p_reservation_id: held.data,
    p_description: `${product.name} monthly renewal`,
    p_actor: "cron:renew",
  });
  if (captured.error) {
    await supabase.rpc("release_xp", {
      p_reservation_id: held.data,
      p_description: "Monthly renewal failed",
      p_actor: "cron:renew",
    });
    await supabase.rpc("bump_subscription_attempt", { p_id: row.id });
    throw captured.error;
  }

  const next = addDays(new Date(Math.max(new Date(row.renews_at).getTime(), now.getTime())), 30);
  const advanced = await supabase.rpc("advance_subscription", {
    p_id: row.id,
    p_renews_at: next.toISOString(),
    p_amount: product.xp,
  });
  if (advanced.error) throw advanced.error;
  await recordAudit(supabase, {
    event_type: "subscription_renewed",
    dedupe_key: `subscription_renewed:${row.id}:${new Date(row.renews_at).toISOString().slice(0, 10)}`,
    actor: "cron:renew",
    owner_id: row.owner_id,
    product_key: row.product_key,
    amount_ixis: product.xp,
    reservation_id: typeof held.data === "string" ? held.data : null,
    ledger_transaction_id: typeof captured.data === "string" ? captured.data : null,
    outcome: "ok",
  });
  return "renewed" as const;
}

export async function renewDueIxisSubscriptions(supabase: SupabaseClient, now = new Date()) {
  const due = await supabase
    .from("subscriptions")
    .select("id, owner_id, product_key, source, status, renews_at, cancel_at_period_end, renew_attempt")
    .eq("source", "ixis")
    .in("status", ["active", "past_due"])
    .lte("renews_at", now.toISOString())
    .limit(50);
  if (due.error) throw due.error;
  const counts = { renewed: 0, past_due: 0, canceled: 0, failed: 0 };
  for (const row of (due.data ?? []) as DueRow[]) {
    try {
      const result = await renewIxisSubscription(supabase, row, now);
      if (result === "renewed") counts.renewed += 1;
      else if (result === "past_due") counts.past_due += 1;
      else if (result === "canceled") counts.canceled += 1;
    } catch (error) {
      counts.failed += 1;
      console.error("ixis renewal failed", {
        subscription: row.id,
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return counts;
}
