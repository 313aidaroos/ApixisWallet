// Change note (Claude, Sep 2026): New. Read-only totals (sales, daily cash, per-app) for COMMAND's graph. See docs/LAUNCH_NOTES.md.
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Read-only business summary for the owner's command center (AWAD COMMAND).
 * Auth is a dedicated bearer, WALLET_STATS_KEY. It is NOT a money key: it can't reserve, capture,
 * credit or read a single customer's wallet. Built from audit_events (the legal record) and the
 * wallet_balances view. No IPs or user agents leave this endpoint.
 */

export const CLEARING_OWNER = "00000000-0000-0000-0000-000000000000";
export const SUMMARY_MAX_DAYS = 365;
export const STATS_KEY_MIN_LENGTH = 32;

export type SummaryAuditRow = {
  reference: string;
  occurred_at: string;
  event_type: string;
  outcome: string;
  actor: string | null;
  app_slug: string | null;
  owner_email: string | null;
  product_key: string | null;
  amount_ixis: number | null;
  amount_cents: number | null;
  reservation_id?: string | null;
};

/** Capture rows don't carry amount/app/product; the reserve row for the same reservation does. */
export function fillCapturesFromReserves(rows: SummaryAuditRow[], reserves: SummaryAuditRow[]) {
  const byReservation = new Map<string, SummaryAuditRow>();
  for (const r of reserves) if (r.reservation_id && r.outcome === "ok") byReservation.set(r.reservation_id, r);
  return rows.map((row) => {
    if (row.event_type !== "capture" || !row.reservation_id) return row;
    const reserve = byReservation.get(row.reservation_id);
    if (!reserve) return row;
    return {
      ...row,
      app_slug: row.app_slug ?? reserve.app_slug,
      owner_email: row.owner_email ?? reserve.owner_email,
      product_key: row.product_key ?? reserve.product_key,
      amount_ixis: row.amount_ixis ?? reserve.amount_ixis,
    };
  });
}

export type SummaryDay = {
  day: string;
  cashInCents: number;
  refundCents: number;
  ixisSold: number;
  ixisRedeemed: number;
  purchases: number;
  redemptions: number;
};

export type WalletSummary = {
  generatedAt: string;
  days: number;
  since: string;
  totals: {
    cashInCents: number;
    refundCents: number;
    netCashCents: number;
    ixisSold: number;
    ixisRedeemed: number;
    purchases: number;
    redemptions: number;
    rejected: number;
  };
  series: SummaryDay[];
  byApp: Array<{ app: string; ixisRedeemed: number; redemptions: number }>;
  holdings: { customers: number; availableIxis: number; reservedIxis: number; liabilityUsd: number };
  activeEntitlements: number | null;
  recent: Array<{
    reference: string;
    at: string;
    type: string;
    outcome: string;
    app: string | null;
    email: string | null;
    product: string | null;
    ixis: number | null;
    cents: number | null;
  }>;
};

function bearer(request: Request) {
  const match = /^Bearer\s+(.+)$/i.exec((request.headers.get("authorization") ?? "").trim());
  return match ? match[1].trim() : "";
}

/** "ok" | "unconfigured" | "unauthorized". Constant-time compare. */
export function checkStatsKey(request: Request): "ok" | "unconfigured" | "unauthorized" {
  const expected = (process.env.WALLET_STATS_KEY ?? "").trim();
  if (expected.length < STATS_KEY_MIN_LENGTH) return "unconfigured";
  const token = bearer(request);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "unauthorized";
}

export function parseDays(value: string | null) {
  const n = Number(value ?? "30");
  if (!Number.isFinite(n)) return 30;
  return Math.min(SUMMARY_MAX_DAYS, Math.max(1, Math.floor(n)));
}

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

/** Pure aggregation, so it can be unit-tested without a database. Days are UTC. */
export function aggregateSummary(input: {
  rows: SummaryAuditRow[];
  balances: Array<{ owner_id: string; available_xp: number | string; reserved_xp: number | string }>;
  activeEntitlements: number | null;
  days: number;
  now: Date;
}): WalletSummary {
  const { rows, balances, activeEntitlements, days, now } = input;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
  const series = new Map<string, SummaryDay>();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    series.set(d, { day: d, cashInCents: 0, refundCents: 0, ixisSold: 0, ixisRedeemed: 0, purchases: 0, redemptions: 0 });
  }
  const byApp = new Map<string, { app: string; ixisRedeemed: number; redemptions: number }>();
  let rejected = 0;

  for (const row of rows) {
    if (row.outcome !== "ok") {
      rejected += 1;
      continue;
    }
    const bucket = series.get(dayKey(row.occurred_at));
    if (!bucket) continue;
    const cents = Math.abs(Number(row.amount_cents ?? 0));
    const ixis = Math.abs(Number(row.amount_ixis ?? 0));
    switch (row.event_type) {
      case "purchase":
        bucket.cashInCents += cents;
        bucket.ixisSold += ixis;
        bucket.purchases += 1;
        break;
      case "refund":
      case "dispute_lost":
        bucket.refundCents += cents;
        break;
      case "capture":
      case "redeem": {
        bucket.ixisRedeemed += ixis;
        bucket.redemptions += 1;
        const app = row.app_slug ?? "unknown";
        const entry = byApp.get(app) ?? { app, ixisRedeemed: 0, redemptions: 0 };
        entry.ixisRedeemed += ixis;
        entry.redemptions += 1;
        byApp.set(app, entry);
        break;
      }
      default:
        break;
    }
  }

  const list = [...series.values()];
  const sum = (pick: (d: SummaryDay) => number) => list.reduce((acc, d) => acc + pick(d), 0);
  const cashInCents = sum((d) => d.cashInCents);
  const refundCents = sum((d) => d.refundCents);

  let customers = 0;
  let availableIxis = 0;
  let reservedIxis = 0;
  for (const b of balances) {
    if (b.owner_id === CLEARING_OWNER) continue;
    customers += 1;
    availableIxis += Number(b.available_xp) || 0;
    reservedIxis += Number(b.reserved_xp) || 0;
  }

  const recent = [...rows]
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, 25)
    .map((row) => ({
      reference: row.reference,
      at: row.occurred_at,
      type: row.event_type,
      outcome: row.outcome,
      app: row.app_slug,
      email: row.owner_email,
      product: row.product_key,
      ixis: row.amount_ixis === null ? null : Number(row.amount_ixis),
      cents: row.amount_cents === null ? null : Number(row.amount_cents),
    }));

  return {
    generatedAt: now.toISOString(),
    days,
    since: start.toISOString(),
    totals: {
      cashInCents,
      refundCents,
      netCashCents: cashInCents - refundCents,
      ixisSold: sum((d) => d.ixisSold),
      ixisRedeemed: sum((d) => d.ixisRedeemed),
      purchases: sum((d) => d.purchases),
      redemptions: sum((d) => d.redemptions),
      rejected,
    },
    series: list,
    byApp: [...byApp.values()].sort((a, b) => b.ixisRedeemed - a.ixisRedeemed),
    holdings: { customers, availableIxis, reservedIxis, liabilityUsd: availableIxis / 100 },
    activeEntitlements,
    recent,
  };
}

export async function loadWalletSummary(supabase: SupabaseClient, days: number, now = new Date()) {
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
  const [audit, balances, entitlements] = await Promise.all([
    supabase
      .from("audit_events")
      .select("reference, occurred_at, event_type, outcome, actor, app_slug, owner_email, product_key, amount_ixis, amount_cents, reservation_id")
      .gte("occurred_at", since.toISOString())
      .in("event_type", ["purchase", "refund", "dispute_lost", "capture", "redeem"])
      .order("occurred_at", { ascending: false })
      .limit(10_000),
    supabase.from("wallet_balances").select("owner_id, available_xp, reserved_xp").limit(100_000),
    supabase
      .from("entitlements")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .or(`renews_at.is.null,renews_at.gt.${now.toISOString()}`),
  ]);
  if (audit.error) throw new Error(`audit_events: ${audit.error.message}`);
  if (balances.error) throw new Error(`wallet_balances: ${balances.error.message}`);
  let rows = (audit.data ?? []) as SummaryAuditRow[];
  const captureIds = [...new Set(rows.filter((r) => r.event_type === "capture" && r.reservation_id).map((r) => r.reservation_id as string))];
  for (let i = 0; i < captureIds.length; i += 200) {
    const reserves = await supabase
      .from("audit_events")
      .select("reference, occurred_at, event_type, outcome, actor, app_slug, owner_email, product_key, amount_ixis, amount_cents, reservation_id")
      .eq("event_type", "reserve")
      .eq("outcome", "ok")
      .in("reservation_id", captureIds.slice(i, i + 200));
    if (reserves.error) throw new Error(`audit_events reserves: ${reserves.error.message}`);
    rows = fillCapturesFromReserves(rows, (reserves.data ?? []) as SummaryAuditRow[]);
  }
  return aggregateSummary({
    rows,
    balances: balances.data ?? [],
    activeEntitlements: entitlements.error ? null : entitlements.count ?? 0,
    days,
    now,
  });
}
