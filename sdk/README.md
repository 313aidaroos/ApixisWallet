# Apixis Wallet SDK v2 — one file, every site

Copy `apixis-wallet.ts` into your repo as `lib/apixis-wallet.ts` (replace any older copy). Server only.

Env on your site: `WALLET_API_KEY` = **your site's own** `apx_live_…` key (ask the Wallet lead), `APIXIS_WALLET_API_URL=https://apixis-wallet.vercel.app`.

```ts
import { redeem, hasEntitlement, buyIxisUrl } from "@/lib/apixis-wallet";

// in a Route Handler, after you have the signed-in user from YOUR Supabase session:
const r = await redeem({
  ownerEmail: user.email!,                                   // VERIFIED email; uids differ per site
  productKey: "renoxis.activate",
  idempotencyKey: `renoxis-activate-${user.id}-${attemptId}`, // 8–80 printable chars, no spaces
  provision: async () => grantSeat(user.id),                 // runs while the Ixis are held
  unprovision: async (_hold, seat) => revokeSeat(seat),      // only called if the customer was NOT charged
});
if (!r.ok) return NextResponse.json({ error: r.message, buy: buyIxisUrl("renoxis", returnUrl) }, { status: 402 });

// gating a feature (monthly rows expire on their own; one-time rows never do):
if (!(await hasEntitlement(user.email!, "renoxis", "renoxis.activate"))) redirect("/pricing");
```

What `redeem()` guarantees:
- `provision()` throws → hold released, nothing charged, error rethrown.
- capture fails → retried once; then release. If the Wallet answers `already_captured`, the customer **was** charged and `redeem()` returns ok (access kept). If the release succeeds, the customer was not charged and `unprovision()` runs. If the Wallet is unreachable, access is kept and the error is rethrown — reconcile with `reservationStatus(id)`.
- 402 is a normal outcome → `{ ok: false, insufficient: true }`. Show "Buy Ixis".

Other exports: `quote`, `reserve`, `capture`, `release`, `reservationStatus`, `entitlements`, `hasEntitlement`, `buyIxisUrl`, `WalletError` (`.status`, `.code`, `.insufficient`).
Product keys are the canonical catalog (`lib/catalog.ts`). Run `npx tsc --noEmit` after copying. Contract: `docs/INTEGRATION.md`.
