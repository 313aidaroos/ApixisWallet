# Apixis Wallet SDK — one file, every site

Copy `apixis-wallet.ts` into your repo as `lib/apixis-wallet.ts`. Server only.

```ts
import { redeem, hasEntitlement, buyIxisUrl } from "@/lib/apixis-wallet";

// in a Route Handler, after you have the signed-in user from YOUR Supabase session:
const r = await redeem({
  ownerEmail: user.email!,   // email is the family identity; uids differ per site
  productKey: "renoxis.activate",
  idempotencyKey (8–80 chars — the Wallet rejects longer with 400 "Invalid reservation"): `renoxis-activate-${user.id}-${attemptId}`,
  provision: async () => grantSeat(user.id),     // your side effect; runs while Ixis are held
});
if (!r.ok) return NextResponse.json({ error: r.message, buy: buyIxisUrl("renoxis", returnUrl) }, { status: 402 });

// gating a feature:
if (!(await hasEntitlement(user.email!, "renoxis", "renoxis.activate"))) redirect("/pricing");
```

Rules baked in: Wallet owns entitlements (you read, never write) · reserve→provision→capture,
release on any failure · 402 = "Buy Ixis", not an error · never fake success.
Product keys are the canonical catalog (`lib/catalog.ts`). Run `npx tsc --noEmit` after copying.
