import { Suspense } from "react";
import { WalletScreen } from "@/components/WalletScreen";
import { ixisUnitLabel } from "@/lib/ixis-asset/mode";

export const dynamic = "force-dynamic";

export default function Home() {
  const unitLabel = ixisUnitLabel();
  return (
    <Suspense fallback={<main><section className="shell solo"><p>Loading wallet…</p></section></main>}>
      <WalletScreen unitLabel={unitLabel} />
    </Suspense>
  );
}
