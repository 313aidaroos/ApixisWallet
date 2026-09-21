import { Suspense } from "react";
import { WalletScreen } from "@/components/WalletScreen";
import { ixisUnitLabel } from "@/lib/ixis-asset/mode";

export const dynamic = "force-dynamic";

export default function BuyPage() {
  const unitLabel = ixisUnitLabel();
  return (
    <Suspense fallback={<main><section className="shell solo"><p>Opening buy…</p></section></main>}>
      <WalletScreen lockTab="buy" unitLabel={unitLabel} />
    </Suspense>
  );
}
